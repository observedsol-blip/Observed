//! Observed — one binary question a day, answered with a probability.
//! Implements docs/01-PROGRAM.md. Mainnet constants only, no per-cluster features.
#![allow(unexpected_cfgs)]
use anchor_lang::prelude::*;
use anchor_spl::token_2022::spl_token_2022::{
    extension::{BaseStateWithExtensions, StateWithExtensions},
    state::Mint as SplMint,
};
use anchor_spl::token_interface::{Mint, Token2022, TokenAccount};
use pyth_solana_receiver_sdk::price_update::{PriceUpdateV2, VerificationLevel};
use solana_sha256_hasher::hashv;
use spl_token_group_interface::state::TokenGroupMember;

declare_id!("48YybyMgkdzPQN5R3V1xsFHkUMxDvBDBDwW48cRTx2ni");

// ---------------------------------------------------------------- constants
/// Seeker Genesis Token group (Token-2022 mint carrying the TokenGroup extension).
pub const SGT_GROUP: Pubkey = pubkey!("GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te");
/// Mint authority of every SGT.
pub const SGT_MINT_AUTHORITY: Pubkey = pubkey!("GT2zuHVaZQYZSyQMgJPLzvkmyztfyXg2NJunqFp4p3A4");

/// Only this key may create the Config. Without it `initialize` is a race on deploy day:
/// whoever calls it first owns calendar and pause authority for that game_id.
/// Built without the `mainnet` feature this is the devnet/test key; the verifiable mainnet build
/// uses `--features mainnet` (see the deploy checklist), which refuses to compile until the
/// offline key is set here.
#[cfg(not(feature = "mainnet"))]
pub const DEPLOY_AUTHORITY: Pubkey = pubkey!("AKnL4NNf3DGWZJS6cPknBuEGnVsV4A4m5tgebLHaRSZ9");
#[cfg(feature = "mainnet")]
compile_error!(
    "mainnet build: set DEPLOY_AUTHORITY below to the offline key's pubkey, then delete this \
     compile_error!. Until then a mainnet artefact cannot be produced by accident."
);
#[cfg(feature = "mainnet")]
pub const DEPLOY_AUTHORITY: Pubkey = pubkey!("11111111111111111111111111111111");

pub const COMMIT_DOMAIN: &[u8] = b"observed/commit/v1";
pub const TERMS_DOMAIN: &[u8] = b"observed/terms/v2";
pub const LEAF_TAG: u8 = 0x00;
pub const NODE_TAG: u8 = 0x01;
/// One season is a fixed 64-leaf tree (depth 6), docs/01-PROGRAM.md §3.
pub const CALENDAR_DEPTH: usize = 6;
pub const CALENDAR_LEAVES: u32 = 64;
/// Accepted oracle window after the reference (12:00) and the outcome (24:00).
pub const ORACLE_WINDOW_SECS: i64 = 60;
pub const REVEAL_WINDOW_SECS: i64 = 12 * 60 * 60;
pub const RESOLVE_WINDOW_SECS: i64 = 24 * 60 * 60;
pub const BUCKETS: usize = 21;
pub const BUCKET_STEP: u16 = 500;
/// What a missing reveal costs: the worst score any revealed answer can get (1.000).
/// Anything lower would make silence profitable — the reveal window opens after the outcome is
/// public, so hiding is always an informed choice (review 18.09.2026, Spec §6).
pub const MISSING_SCORE_BPS: u16 = 10_000;

#[program]
pub mod observed {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        game_id: u64,
        calendar_authority: Pubkey,
        pause_authority: Pubkey,
    ) -> Result<()> {
        let c = &mut ctx.accounts.config;
        c.version = 1;
        c.game_id = game_id;
        c.calendar_authority = calendar_authority;
        c.pause_authority = pause_authority;
        c.paused = false;
        c.next_round_id = 0;
        c.season = 0;
        c.calendar_root = [0u8; 32];
        c.first_round_id = 0;
        c.max_round_id = 0;
        c.bump = ctx.bumps.config;
        Ok(())
    }

    /// One calendar per season, set before the season's first round.
    pub fn publish_calendar(
        ctx: Context<PublishCalendar>,
        season: u16,
        calendar_root: [u8; 32],
        leaf_count: u32,
    ) -> Result<()> {
        let c = &mut ctx.accounts.config;
        let first_season = c.calendar_root == [0u8; 32];
        require!(
            first_season || c.next_round_id > c.max_round_id,
            ObservedError::SeasonNotFinished
        );
        require!(
            (1..=CALENDAR_LEAVES).contains(&leaf_count),
            ObservedError::InvalidLeafCount
        );
        require!(calendar_root != [0u8; 32], ObservedError::EmptyCalendarRoot);
        require!(
            season > c.season || first_season,
            ObservedError::SeasonNotIncreasing
        );
        c.season = season;
        c.calendar_root = calendar_root;
        c.first_round_id = c.next_round_id;
        c.max_round_id = c
            .first_round_id
            .checked_add(leaf_count)
            .ok_or(ObservedError::MathOverflow)?
            .checked_sub(1)
            .ok_or(ObservedError::MathOverflow)?;
        Ok(())
    }

    /// Permissionless: anyone may create the next round, but only with a valid Merkle proof
    /// against the published calendar. Nobody can slip an extra question in.
    pub fn create_round(
        ctx: Context<CreateRound>,
        round_id: u32,
        terms: RoundTerms,
        merkle_proof: Vec<[u8; 32]>,
    ) -> Result<()> {
        let c = &mut ctx.accounts.config;
        require!(c.calendar_root != [0u8; 32], ObservedError::NoCalendar);
        require!(round_id == c.next_round_id, ObservedError::WrongRoundId);
        require!(round_id <= c.max_round_id, ObservedError::SeasonExhausted);
        require!(
            terms.commit_open < terms.commit_close && terms.commit_close < terms.outcome_time,
            ObservedError::BadWindows
        );
        require!(terms.max_conf_bps > 0, ObservedError::BadConfidenceBound);

        let terms_hash = terms.hash(c.season, round_id);
        let index = round_id
            .checked_sub(c.first_round_id)
            .ok_or(ObservedError::WrongRoundId)?;
        require!(
            merkle_proof.len() == CALENDAR_DEPTH,
            ObservedError::BadProofLength
        );
        require!(
            verify_leaf(&terms_hash, index, &merkle_proof, &c.calendar_root),
            ObservedError::BadMerkleProof
        );

        let r = &mut ctx.accounts.round;
        r.round_id = round_id;
        r.terms_hash = terms_hash;
        r.feed_id = terms.feed_id;
        r.offset_bps = terms.offset_bps;
        r.max_conf_bps = terms.max_conf_bps;
        r.commit_open = terms.commit_open;
        r.commit_close = terms.commit_close;
        r.outcome_time = terms.outcome_time;
        r.reveal_close = terms
            .outcome_time
            .checked_add(REVEAL_WINDOW_SECS)
            .ok_or(ObservedError::MathOverflow)?;
        r.resolve_deadline = terms
            .outcome_time
            .checked_add(RESOLVE_WINDOW_SECS)
            .ok_or(ObservedError::MathOverflow)?;
        r.status = RoundStatus::Open as u8;
        r.outcome = Outcome::Unset as u8;
        r.bump = ctx.bumps.round;
        c.next_round_id = round_id.checked_add(1).ok_or(ObservedError::MathOverflow)?;
        Ok(())
    }

    /// Seal an answer. The SGT guard runs first, before any state change.
    pub fn commit(ctx: Context<Commit>, commitment: [u8; 32]) -> Result<()> {
        verify_sgt(&ctx.accounts.sgt_mint, &ctx.accounts.sgt_token_account)?;

        let now = Clock::get()?.unix_timestamp;
        let round = &mut ctx.accounts.round;
        require!(!ctx.accounts.config.paused, ObservedError::Paused);
        require!(
            round.status == RoundStatus::Open as u8,
            ObservedError::RoundNotOpen
        );
        require!(
            now >= round.commit_open && now < round.commit_close,
            ObservedError::OutsideCommitWindow
        );

        let entry = &mut ctx.accounts.entry;
        entry.round = round.key();
        entry.sgt_mint = ctx.accounts.sgt_mint.key();
        entry.beneficiary = ctx.accounts.player_wallet.key();
        entry.rent_refund_to = ctx.accounts.player_wallet.key();
        entry.commitment = commitment;
        entry.committed_at = now;
        entry.revealed = false;
        entry.p_bps = 0;
        entry.scored = false;
        entry.scored_as_missing = false;
        entry.score_bps = 0;
        entry.bump = ctx.bumps.entry;

        let player = &mut ctx.accounts.player;
        if player.sgt_mint == Pubkey::default() {
            player.sgt_mint = ctx.accounts.sgt_mint.key();
            player.bump = ctx.bumps.player;
        }
        player.commits = player
            .commits
            .checked_add(1)
            .ok_or(ObservedError::MathOverflow)?;
        round.commit_count = round
            .commit_count
            .checked_add(1)
            .ok_or(ObservedError::MathOverflow)?;
        Ok(())
    }

    /// Open the sealed answer in the reveal window. No catch-up outside the window.
    pub fn reveal(ctx: Context<Reveal>, p_bps: u16, salt: [u8; 32]) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let round = &mut ctx.accounts.round;
        let entry = &mut ctx.accounts.entry;
        require!(
            now >= round.outcome_time && now < round.reveal_close,
            ObservedError::OutsideRevealWindow
        );
        require!(!entry.revealed, ObservedError::AlreadyRevealed);
        require!(p_bps <= 10_000, ObservedError::InvalidProbability);
        require!(
            p_bps.is_multiple_of(BUCKET_STEP),
            ObservedError::InvalidProbability
        );

        let expected = commitment_hash(
            &round.key(),
            &round.terms_hash,
            &entry.sgt_mint,
            &entry.beneficiary,
            p_bps,
            &salt,
        );
        require!(
            expected == entry.commitment,
            ObservedError::CommitmentMismatch
        );

        entry.revealed = true;
        entry.p_bps = p_bps;
        round.reveal_count = round
            .reveal_count
            .checked_add(1)
            .ok_or(ObservedError::MathOverflow)?;
        let bucket = (p_bps / BUCKET_STEP) as usize;
        round.histogram[bucket] = round.histogram[bucket]
            .checked_add(1)
            .ok_or(ObservedError::MathOverflow)?;
        let player = &mut ctx.accounts.player;
        player.reveals = player
            .reveals
            .checked_add(1)
            .ok_or(ObservedError::MathOverflow)?;
        Ok(())
    }

    /// Permissionless: the first valid Pyth update after commit close (12:00 UTC) fixes the
    /// reference price, and with it the threshold. Nobody knows it while sealing.
    pub fn set_reference(ctx: Context<SetReference>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let round = &mut ctx.accounts.round;
        require!(
            round.status == RoundStatus::Open as u8,
            ObservedError::RoundNotOpen
        );
        require!(now >= round.commit_close, ObservedError::TooEarly);
        require!(now < round.resolve_deadline, ObservedError::TooLate);

        let m = accept_update(
            &ctx.accounts.price_update,
            &round.feed_id,
            round.commit_close,
            round.max_conf_bps,
        )?;

        // threshold = ref_price * (10_000 + offset_bps) / 10_000, same exponent, truncated to zero
        let factor = 10_000i128
            .checked_add(round.offset_bps as i128)
            .ok_or(ObservedError::MathOverflow)?;
        require!(factor > 0, ObservedError::BadOffset);
        let threshold = (m.price as i128)
            .checked_mul(factor)
            .ok_or(ObservedError::MathOverflow)?
            .checked_div(10_000)
            .ok_or(ObservedError::MathOverflow)?;
        round.threshold_mantissa =
            i64::try_from(threshold).map_err(|_| ObservedError::MathOverflow)?;

        round.ref_price = m.price;
        round.ref_expo = m.exponent;
        round.ref_conf = m.conf;
        round.ref_publish_time = m.publish_time;
        round.ref_prev_publish_time = m.prev_publish_time;
        round.referencer = ctx.accounts.referencer.key();
        round.status = RoundStatus::Referenced as u8;
        Ok(())
    }

    /// Permissionless: the first valid Pyth update after the outcome time (24:00 UTC) decides.
    /// Equality resolves No.
    pub fn resolve(ctx: Context<Resolve>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let round = &mut ctx.accounts.round;
        require!(
            round.status == RoundStatus::Referenced as u8,
            ObservedError::NoReference
        );
        require!(now >= round.outcome_time, ObservedError::TooEarly);
        require!(now < round.resolve_deadline, ObservedError::TooLate);

        let m = accept_update(
            &ctx.accounts.price_update,
            &round.feed_id,
            round.outcome_time,
            round.max_conf_bps,
        )?;

        let (price, threshold) = normalize(
            m.price,
            m.exponent,
            round.threshold_mantissa,
            round.ref_expo,
        )?;
        round.outcome = if price > threshold {
            Outcome::Yes as u8
        } else {
            Outcome::No as u8
        };
        round.evidence_price = m.price;
        round.evidence_conf = m.conf;
        round.evidence_expo = m.exponent;
        round.evidence_publish_time = m.publish_time;
        round.evidence_prev_publish_time = m.prev_publish_time;
        round.resolver = ctx.accounts.resolver.key();
        round.status = RoundStatus::Resolved as u8;
        Ok(())
    }

    /// Permissionless and idempotent. A missing reveal costs a full miss once the window is
    /// closed. A cancelled round (NO_RESOLVE) is never scored — nobody may carry a full miss for
    /// a round that had no outcome; the round status check below is what enforces it.
    pub fn score_entry(ctx: Context<ScoreEntry>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let round = &ctx.accounts.round;
        let entry = &mut ctx.accounts.entry;
        require!(
            round.status == RoundStatus::Resolved as u8,
            ObservedError::RoundNotResolved
        );
        require!(!entry.scored, ObservedError::AlreadyScored);
        require!(
            entry.revealed || now >= round.reveal_close,
            ObservedError::RevealWindowStillOpen
        );

        let player = &mut ctx.accounts.player;
        let score_bps = if entry.revealed {
            brier_score_bps(entry.p_bps, round.outcome == Outcome::Yes as u8)?
        } else {
            entry.scored_as_missing = true;
            player.missing_scored = player
                .missing_scored
                .checked_add(1)
                .ok_or(ObservedError::MathOverflow)?;
            MISSING_SCORE_BPS
        };
        entry.score_bps = score_bps;
        entry.scored = true;
        player.score_sum = player
            .score_sum
            .checked_add(score_bps as u64)
            .ok_or(ObservedError::MathOverflow)?;
        player.scored_rounds = player
            .scored_rounds
            .checked_add(1)
            .ok_or(ObservedError::MathOverflow)?;
        Ok(())
    }

    /// Permissionless: no valid evidence in time → NO_RESOLVE. Nobody is scored.
    pub fn cancel_round(ctx: Context<CancelRound>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let round = &mut ctx.accounts.round;
        require!(now >= round.resolve_deadline, ObservedError::TooEarly);
        require!(
            round.status != RoundStatus::Resolved as u8,
            ObservedError::AlreadyResolved
        );
        require!(
            round.status != RoundStatus::Cancelled as u8,
            ObservedError::AlreadyCancelled
        );
        round.status = RoundStatus::Cancelled as u8;
        Ok(())
    }

    /// Rent back, but only after the entry can no longer change the record.
    pub fn close_entry(ctx: Context<CloseEntry>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let round = &ctx.accounts.round;
        let entry = &ctx.accounts.entry;
        require!(now >= round.reveal_close, ObservedError::TooEarly);
        let closable = (round.status == RoundStatus::Resolved as u8 && entry.scored)
            || round.status == RoundStatus::Cancelled as u8;
        require!(closable, ObservedError::EntryNotClosable);
        Ok(())
    }

    /// Blocks new commits only — never reveal, resolve, score or close.
    pub fn pause(ctx: Context<Pause>, flag: bool) -> Result<()> {
        ctx.accounts.config.paused = flag;
        Ok(())
    }
}

// ---------------------------------------------------------------- helpers

/// SGT gate (docs/01-PROGRAM.md §3 commit): one function, called first, no state written yet.
pub fn verify_sgt(
    mint: &InterfaceAccount<Mint>,
    token_account: &InterfaceAccount<TokenAccount>,
) -> Result<()> {
    require!(
        Option::<Pubkey>::from(mint.mint_authority) == Some(SGT_MINT_AUTHORITY),
        ObservedError::WrongMintAuthority
    );
    require!(mint.supply == 1, ObservedError::WrongSupply);
    require!(mint.decimals == 0, ObservedError::WrongDecimals);
    // Real SGT token accounts are frozen; the state is deliberately not checked (Spike 2).
    require!(token_account.amount == 1, ObservedError::WrongAmount);

    let info = mint.to_account_info();
    let data = info.try_borrow_data()?;
    let state =
        StateWithExtensions::<SplMint>::unpack(&data).map_err(|_| ObservedError::NotAMint)?;
    let member = state
        .get_extension::<TokenGroupMember>()
        .map_err(|_| ObservedError::NotAGroupMember)?;
    require_keys_eq!(
        Pubkey::from(member.group.to_bytes()),
        SGT_GROUP,
        ObservedError::WrongGroup
    );
    require_keys_eq!(
        Pubkey::from(member.mint.to_bytes()),
        mint.key(),
        ObservedError::MemberMintMismatch
    );
    Ok(())
}

/// Spec §4 commitment, byte for byte.
pub fn commitment_hash(
    round: &Pubkey,
    terms_hash: &[u8; 32],
    sgt_mint: &Pubkey,
    beneficiary: &Pubkey,
    p_bps: u16,
    salt: &[u8; 32],
) -> [u8; 32] {
    hashv(&[
        COMMIT_DOMAIN,
        crate::ID.as_ref(),
        round.as_ref(),
        terms_hash,
        sgt_mint.as_ref(),
        beneficiary.as_ref(),
        &p_bps.to_le_bytes(),
        salt,
    ])
    .to_bytes()
}

/// Brier in score_bps: k = p_bps/500, score = 25·(k − 20y)².
pub fn brier_score_bps(p_bps: u16, yes: bool) -> Result<u16> {
    let k = (p_bps / BUCKET_STEP) as i32;
    let y = if yes { 20i32 } else { 0i32 };
    let d = k.checked_sub(y).ok_or(ObservedError::MathOverflow)?;
    let score = 25i32
        .checked_mul(d.checked_mul(d).ok_or(ObservedError::MathOverflow)?)
        .ok_or(ObservedError::MathOverflow)?;
    u16::try_from(score).map_err(|_| ObservedError::MathOverflow.into())
}

/// The accepted price message for time `t`: the first update at or after `t`, fully verified.
fn accept_update(
    update: &Account<PriceUpdateV2>,
    feed_id: &[u8; 32],
    t: i64,
    max_conf_bps: u16,
) -> Result<AcceptedUpdate> {
    require!(
        update.verification_level == VerificationLevel::Full,
        ObservedError::NotFullyVerified
    );
    let m = &update.price_message;
    require!(&m.feed_id == feed_id, ObservedError::WrongFeed);
    require!(m.prev_publish_time < t, ObservedError::NotFirstAfter);
    require!(t <= m.publish_time, ObservedError::BeforeWindow);
    let latest = t
        .checked_add(ORACLE_WINDOW_SECS)
        .ok_or(ObservedError::MathOverflow)?;
    require!(m.publish_time <= latest, ObservedError::OutsideOracleWindow);
    require!(m.price > 0, ObservedError::NonPositivePrice);

    let price = u128::try_from(m.price).map_err(|_| ObservedError::MathOverflow)?;
    let conf_bps = u128::from(m.conf)
        .checked_mul(10_000)
        .ok_or(ObservedError::MathOverflow)?
        .checked_div(price)
        .ok_or(ObservedError::MathOverflow)?;
    require!(
        conf_bps <= u128::from(max_conf_bps),
        ObservedError::ConfidenceTooWide
    );
    Ok(AcceptedUpdate {
        price: m.price,
        conf: m.conf,
        exponent: m.exponent,
        publish_time: m.publish_time,
        prev_publish_time: m.prev_publish_time,
    })
}

pub struct AcceptedUpdate {
    pub price: i64,
    pub conf: u64,
    pub exponent: i32,
    pub publish_time: i64,
    pub prev_publish_time: i64,
}

/// Bring two mantissas to the smaller (more precise) exponent, checked. Never truncates.
fn normalize(a: i64, expo_a: i32, b: i64, expo_b: i32) -> Result<(i128, i128)> {
    let (mut x, mut y) = (a as i128, b as i128);
    if expo_a > expo_b {
        x = scale(x, expo_a - expo_b)?;
    } else if expo_b > expo_a {
        y = scale(y, expo_b - expo_a)?;
    }
    Ok((x, y))
}

fn scale(v: i128, steps: i32) -> Result<i128> {
    let steps = u32::try_from(steps).map_err(|_| ObservedError::MathOverflow)?;
    require!(steps <= 38, ObservedError::MathOverflow);
    let factor = 10i128
        .checked_pow(steps)
        .ok_or(ObservedError::MathOverflow)?;
    v.checked_mul(factor)
        .ok_or(ObservedError::MathOverflow.into())
}

/// Merkle with domain separation; the path position comes from the index bits only.
pub fn verify_leaf(terms_hash: &[u8; 32], index: u32, proof: &[[u8; 32]], root: &[u8; 32]) -> bool {
    let mut node = hashv(&[&[LEAF_TAG], terms_hash]).to_bytes();
    let mut idx = index;
    for sibling in proof {
        node = if idx.is_multiple_of(2) {
            hashv(&[&[NODE_TAG], &node, sibling]).to_bytes()
        } else {
            hashv(&[&[NODE_TAG], sibling, &node]).to_bytes()
        };
        idx /= 2;
    }
    &node == root
}

// ---------------------------------------------------------------- state

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub struct RoundTerms {
    pub feed_id: [u8; 32],
    pub offset_bps: i32,
    pub max_conf_bps: u16,
    pub commit_open: i64,
    pub commit_close: i64,
    pub outcome_time: i64,
}

impl RoundTerms {
    /// Canonical `terms_hash` (docs/01-PROGRAM.md §3 create_round), v2: rule only, no threshold,
    /// no question text.
    pub fn hash(&self, season: u16, round_id: u32) -> [u8; 32] {
        hashv(&[
            TERMS_DOMAIN,
            &season.to_le_bytes(),
            &round_id.to_le_bytes(),
            &self.feed_id,
            &self.offset_bps.to_le_bytes(),
            &self.max_conf_bps.to_le_bytes(),
            &self.commit_open.to_le_bytes(),
            &self.commit_close.to_le_bytes(),
            &self.outcome_time.to_le_bytes(),
        ])
        .to_bytes()
    }
}

#[repr(u8)]
pub enum RoundStatus {
    Open = 0,
    Closed = 1,
    Referenced = 2,
    Resolved = 3,
    Cancelled = 4,
}

#[repr(u8)]
pub enum Outcome {
    Unset = 0,
    Yes = 1,
    No = 2,
}

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub version: u8,
    pub game_id: u64,
    pub calendar_authority: Pubkey,
    pub pause_authority: Pubkey,
    pub paused: bool,
    pub next_round_id: u32,
    pub season: u16,
    pub calendar_root: [u8; 32],
    pub first_round_id: u32,
    pub max_round_id: u32,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Round {
    pub round_id: u32,
    pub terms_hash: [u8; 32],
    pub feed_id: [u8; 32],
    pub offset_bps: i32,
    pub max_conf_bps: u16,
    pub commit_open: i64,
    pub commit_close: i64,
    pub outcome_time: i64,
    pub reveal_close: i64,
    pub resolve_deadline: i64,
    pub status: u8,
    pub outcome: u8,
    pub ref_price: i64,
    pub ref_expo: i32,
    pub ref_conf: u64,
    pub ref_publish_time: i64,
    pub ref_prev_publish_time: i64,
    pub threshold_mantissa: i64,
    pub referencer: Pubkey,
    pub evidence_price: i64,
    pub evidence_conf: u64,
    pub evidence_expo: i32,
    pub evidence_publish_time: i64,
    pub evidence_prev_publish_time: i64,
    pub resolver: Pubkey,
    pub commit_count: u32,
    pub reveal_count: u32,
    pub histogram: [u32; BUCKETS],
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Entry {
    pub round: Pubkey,
    pub sgt_mint: Pubkey,
    pub beneficiary: Pubkey,
    pub rent_refund_to: Pubkey,
    pub commitment: [u8; 32],
    pub committed_at: i64,
    pub revealed: bool,
    pub p_bps: u16,
    pub scored: bool,
    pub scored_as_missing: bool,
    pub score_bps: u16,
    pub bump: u8,
}

/// No `missing` field: missing = commits − reveals − open entries, derived by the client.
#[account]
#[derive(InitSpace)]
pub struct Player {
    pub sgt_mint: Pubkey,
    pub commits: u32,
    pub reveals: u32,
    pub missing_scored: u32,
    pub score_sum: u64,
    pub scored_rounds: u32,
    pub bump: u8,
}

// ---------------------------------------------------------------- accounts

#[derive(Accounts)]
#[instruction(game_id: u64)]
pub struct Initialize<'info> {
    #[account(mut, address = DEPLOY_AUTHORITY @ ObservedError::WrongAuthority)]
    pub payer: Signer<'info>,
    #[account(
        init,
        payer = payer,
        space = 8 + Config::INIT_SPACE,
        seeds = [b"config", game_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub config: Account<'info, Config>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PublishCalendar<'info> {
    pub calendar_authority: Signer<'info>,
    #[account(
        mut,
        seeds = [b"config", config.game_id.to_le_bytes().as_ref()],
        bump = config.bump,
        has_one = calendar_authority @ ObservedError::WrongAuthority,
    )]
    pub config: Account<'info, Config>,
}

#[derive(Accounts)]
#[instruction(round_id: u32)]
pub struct CreateRound<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        seeds = [b"config", config.game_id.to_le_bytes().as_ref()],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,
    #[account(
        init,
        payer = payer,
        space = 8 + Round::INIT_SPACE,
        seeds = [b"round", config.key().as_ref(), round_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub round: Account<'info, Round>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Commit<'info> {
    #[account(mut)]
    pub player_wallet: Signer<'info>,
    #[account(mint::token_program = token_program)]
    pub sgt_mint: InterfaceAccount<'info, Mint>,
    #[account(
        token::mint = sgt_mint,
        token::authority = player_wallet,
        token::token_program = token_program,
    )]
    pub sgt_token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(
        seeds = [b"config", config.game_id.to_le_bytes().as_ref()],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,
    #[account(
        mut,
        seeds = [b"round", config.key().as_ref(), round.round_id.to_le_bytes().as_ref()],
        bump = round.bump,
    )]
    pub round: Account<'info, Round>,
    #[account(
        init,
        payer = player_wallet,
        space = 8 + Entry::INIT_SPACE,
        seeds = [b"entry", round.key().as_ref(), sgt_mint.key().as_ref()],
        bump,
    )]
    pub entry: Account<'info, Entry>,
    #[account(
        init_if_needed,
        payer = player_wallet,
        space = 8 + Player::INIT_SPACE,
        seeds = [b"player", config.key().as_ref(), sgt_mint.key().as_ref()],
        bump,
        constraint = player.sgt_mint == Pubkey::default() || player.sgt_mint == sgt_mint.key()
            @ ObservedError::PlayerMintMismatch,
    )]
    pub player: Account<'info, Player>,
    pub token_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Reveal<'info> {
    pub beneficiary: Signer<'info>,
    #[account(
        seeds = [b"config", config.game_id.to_le_bytes().as_ref()],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,
    #[account(
        mut,
        seeds = [b"round", config.key().as_ref(), round.round_id.to_le_bytes().as_ref()],
        bump = round.bump,
    )]
    pub round: Account<'info, Round>,
    #[account(
        mut,
        seeds = [b"entry", round.key().as_ref(), entry.sgt_mint.as_ref()],
        bump = entry.bump,
        has_one = beneficiary @ ObservedError::WrongBeneficiary,
        constraint = entry.round == round.key() @ ObservedError::EntryRoundMismatch,
    )]
    pub entry: Account<'info, Entry>,
    #[account(
        mut,
        seeds = [b"player", config.key().as_ref(), entry.sgt_mint.as_ref()],
        bump = player.bump,
        constraint = player.sgt_mint == entry.sgt_mint @ ObservedError::PlayerMintMismatch,
    )]
    pub player: Account<'info, Player>,
}

#[derive(Accounts)]
pub struct SetReference<'info> {
    pub referencer: Signer<'info>,
    #[account(
        seeds = [b"config", config.game_id.to_le_bytes().as_ref()],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,
    #[account(
        mut,
        seeds = [b"round", config.key().as_ref(), round.round_id.to_le_bytes().as_ref()],
        bump = round.bump,
    )]
    pub round: Account<'info, Round>,
    /// Owner (Pyth receiver) and discriminator are checked by `Account`.
    pub price_update: Account<'info, PriceUpdateV2>,
}

#[derive(Accounts)]
pub struct Resolve<'info> {
    pub resolver: Signer<'info>,
    #[account(
        seeds = [b"config", config.game_id.to_le_bytes().as_ref()],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,
    #[account(
        mut,
        seeds = [b"round", config.key().as_ref(), round.round_id.to_le_bytes().as_ref()],
        bump = round.bump,
    )]
    pub round: Account<'info, Round>,
    pub price_update: Account<'info, PriceUpdateV2>,
}

#[derive(Accounts)]
pub struct ScoreEntry<'info> {
    #[account(
        seeds = [b"config", config.game_id.to_le_bytes().as_ref()],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,
    #[account(
        seeds = [b"round", config.key().as_ref(), round.round_id.to_le_bytes().as_ref()],
        bump = round.bump,
    )]
    pub round: Account<'info, Round>,
    #[account(
        mut,
        seeds = [b"entry", round.key().as_ref(), entry.sgt_mint.as_ref()],
        bump = entry.bump,
        constraint = entry.round == round.key() @ ObservedError::EntryRoundMismatch,
    )]
    pub entry: Account<'info, Entry>,
    #[account(
        mut,
        seeds = [b"player", config.key().as_ref(), entry.sgt_mint.as_ref()],
        bump = player.bump,
        constraint = player.sgt_mint == entry.sgt_mint @ ObservedError::PlayerMintMismatch,
    )]
    pub player: Account<'info, Player>,
}

#[derive(Accounts)]
pub struct CancelRound<'info> {
    #[account(
        seeds = [b"config", config.game_id.to_le_bytes().as_ref()],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,
    #[account(
        mut,
        seeds = [b"round", config.key().as_ref(), round.round_id.to_le_bytes().as_ref()],
        bump = round.bump,
    )]
    pub round: Account<'info, Round>,
}

#[derive(Accounts)]
pub struct CloseEntry<'info> {
    #[account(mut)]
    pub rent_refund_to: Signer<'info>,
    #[account(
        seeds = [b"config", config.game_id.to_le_bytes().as_ref()],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,
    #[account(
        seeds = [b"round", config.key().as_ref(), round.round_id.to_le_bytes().as_ref()],
        bump = round.bump,
    )]
    pub round: Account<'info, Round>,
    #[account(
        mut,
        close = rent_refund_to,
        seeds = [b"entry", round.key().as_ref(), entry.sgt_mint.as_ref()],
        bump = entry.bump,
        has_one = rent_refund_to @ ObservedError::WrongRentRefund,
        constraint = entry.round == round.key() @ ObservedError::EntryRoundMismatch,
    )]
    pub entry: Account<'info, Entry>,
}

#[derive(Accounts)]
pub struct Pause<'info> {
    pub pause_authority: Signer<'info>,
    #[account(
        mut,
        seeds = [b"config", config.game_id.to_le_bytes().as_ref()],
        bump = config.bump,
        has_one = pause_authority @ ObservedError::WrongAuthority,
    )]
    pub config: Account<'info, Config>,
}

// ---------------------------------------------------------------- errors

#[error_code]
pub enum ObservedError {
    #[msg("previous season is not finished")]
    SeasonNotFinished,
    #[msg("leaf_count must be 1..=64")]
    InvalidLeafCount,
    #[msg("calendar root must not be zero")]
    EmptyCalendarRoot,
    #[msg("season must increase")]
    SeasonNotIncreasing,
    #[msg("no calendar published")]
    NoCalendar,
    #[msg("round_id must be the next round")]
    WrongRoundId,
    #[msg("season has no more leaves")]
    SeasonExhausted,
    #[msg("commit_open < commit_close < outcome_time violated")]
    BadWindows,
    #[msg("max_conf_bps must be > 0")]
    BadConfidenceBound,
    #[msg("merkle proof must have depth 6")]
    BadProofLength,
    #[msg("terms are not in the published calendar")]
    BadMerkleProof,
    #[msg("new commits are paused")]
    Paused,
    #[msg("round is not open")]
    RoundNotOpen,
    #[msg("outside the commit window")]
    OutsideCommitWindow,
    #[msg("outside the reveal window")]
    OutsideRevealWindow,
    #[msg("already revealed")]
    AlreadyRevealed,
    #[msg("p_bps must be 0..=10000 in steps of 500")]
    InvalidProbability,
    #[msg("commitment does not match")]
    CommitmentMismatch,
    #[msg("too early")]
    TooEarly,
    #[msg("too late")]
    TooLate,
    #[msg("round has no reference yet")]
    NoReference,
    #[msg("round is already resolved")]
    AlreadyResolved,
    #[msg("round is already cancelled")]
    AlreadyCancelled,
    #[msg("round is not resolved")]
    RoundNotResolved,
    #[msg("entry already scored")]
    AlreadyScored,
    #[msg("reveal window is still open")]
    RevealWindowStillOpen,
    #[msg("entry cannot be closed yet")]
    EntryNotClosable,
    #[msg("price update is not fully verified")]
    NotFullyVerified,
    #[msg("feed id does not match")]
    WrongFeed,
    #[msg("not the first update after the timestamp")]
    NotFirstAfter,
    #[msg("publish_time is before the window")]
    BeforeWindow,
    #[msg("publish_time is more than 60 s after the timestamp")]
    OutsideOracleWindow,
    #[msg("price must be > 0")]
    NonPositivePrice,
    #[msg("confidence interval too wide")]
    ConfidenceTooWide,
    #[msg("offset would invert the threshold")]
    BadOffset,
    #[msg("mint authority is not the SGT mint authority")]
    WrongMintAuthority,
    #[msg("supply must be 1")]
    WrongSupply,
    #[msg("decimals must be 0")]
    WrongDecimals,
    #[msg("token account amount must be 1")]
    WrongAmount,
    #[msg("account is not a Token-2022 mint")]
    NotAMint,
    #[msg("mint has no TokenGroupMember extension")]
    NotAGroupMember,
    #[msg("mint is not a member of the SGT group")]
    WrongGroup,
    #[msg("TokenGroupMember.mint does not match the mint")]
    MemberMintMismatch,
    #[msg("player account belongs to another mint")]
    PlayerMintMismatch,
    #[msg("entry belongs to another round")]
    EntryRoundMismatch,
    #[msg("signer is not the beneficiary")]
    WrongBeneficiary,
    #[msg("signer is not the rent refund target")]
    WrongRentRefund,
    #[msg("wrong authority")]
    WrongAuthority,
    #[msg("arithmetic overflow")]
    MathOverflow,
}
