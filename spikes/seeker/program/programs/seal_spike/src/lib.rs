//! SPIKE 3 ONLY — devnet stand-in for `commit`/`reveal` so the Seeker app can test
//! "reveal(R-1) + commit(R) in one transaction" via MWA. Not the product:
//! no SGT gate, no rounds, no time windows. Never deploy to mainnet.
//!
//! Commitment layout mirrors Spec §4 byte for byte, with spike placeholders:
//! sha256("observed/commit/v1" ‖ program_id ‖ round_pubkey ‖ terms_hash ‖ sgt_mint ‖ beneficiary ‖ p_bps_u16_le ‖ salt_32)
//! round_pubkey = PDA ["round", round_id_le] (no account), terms_hash = [0;32], sgt_mint = beneficiary.
use anchor_lang::prelude::*;
use solana_sha256_hasher::hashv;

declare_id!("2yoZYJMfBkBhtB6cdRJQQKrX3Me5zFZyT7y4P9kDkRxQ");

pub const COMMIT_DOMAIN: &[u8] = b"observed/commit/v1";

#[program]
pub mod seal_spike {
    use super::*;

    pub fn commit(ctx: Context<Commit>, round_id: u32, commitment: [u8; 32]) -> Result<()> {
        let entry = &mut ctx.accounts.entry;
        entry.round_id = round_id;
        entry.beneficiary = ctx.accounts.player.key();
        entry.commitment = commitment;
        entry.committed_at = Clock::get()?.unix_timestamp;
        entry.revealed = false;
        entry.p_bps = 0;
        entry.bump = ctx.bumps.entry;
        Ok(())
    }

    pub fn reveal(ctx: Context<Reveal>, round_id: u32, p_bps: u16, salt: [u8; 32]) -> Result<()> {
        let entry = &mut ctx.accounts.entry;
        require!(!entry.revealed, SealError::AlreadyRevealed);
        require!(
            p_bps <= 10_000 && p_bps.is_multiple_of(500),
            SealError::InvalidProbability
        );
        let expected = commitment_for(round_id, &entry.beneficiary, p_bps, &salt);
        require!(expected == entry.commitment, SealError::CommitmentMismatch);
        entry.revealed = true;
        entry.p_bps = p_bps;
        Ok(())
    }
}

pub fn round_pubkey(round_id: u32) -> Pubkey {
    Pubkey::find_program_address(&[b"round", &round_id.to_le_bytes()], &crate::ID).0
}

pub fn commitment_for(
    round_id: u32,
    beneficiary: &Pubkey,
    p_bps: u16,
    salt: &[u8; 32],
) -> [u8; 32] {
    let round = round_pubkey(round_id);
    let terms_hash = [0u8; 32];
    let sgt_mint = beneficiary; // spike placeholder
    hashv(&[
        COMMIT_DOMAIN,
        crate::ID.as_ref(),
        round.as_ref(),
        &terms_hash,
        sgt_mint.as_ref(),
        beneficiary.as_ref(),
        &p_bps.to_le_bytes(),
        salt,
    ])
    .to_bytes()
}

#[derive(Accounts)]
#[instruction(round_id: u32)]
pub struct Commit<'info> {
    #[account(mut)]
    pub player: Signer<'info>,
    #[account(
        init,
        payer = player,
        space = 8 + Entry::INIT_SPACE,
        seeds = [b"entry", round_id.to_le_bytes().as_ref(), player.key().as_ref()],
        bump,
    )]
    pub entry: Account<'info, Entry>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(round_id: u32)]
pub struct Reveal<'info> {
    pub beneficiary: Signer<'info>,
    #[account(
        mut,
        seeds = [b"entry", round_id.to_le_bytes().as_ref(), beneficiary.key().as_ref()],
        bump = entry.bump,
        has_one = beneficiary,
    )]
    pub entry: Account<'info, Entry>,
}

#[account]
#[derive(InitSpace)]
pub struct Entry {
    pub round_id: u32,
    pub beneficiary: Pubkey,
    pub commitment: [u8; 32],
    pub committed_at: i64,
    pub revealed: bool,
    pub p_bps: u16,
    pub bump: u8,
}

#[error_code]
pub enum SealError {
    #[msg("already revealed")]
    AlreadyRevealed,
    #[msg("p_bps must be 0..=10000 in steps of 500")]
    InvalidProbability,
    #[msg("commitment does not match")]
    CommitmentMismatch,
}
