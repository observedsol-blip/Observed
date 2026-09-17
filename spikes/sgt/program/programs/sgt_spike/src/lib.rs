//! Spike 2: Seeker Genesis Token gate for `commit` (docs/01-PROGRAM.md §3 commit, points 2–4).
//! Throwaway code, not the product. Mainnet constants only — no per-cluster features.
use anchor_lang::prelude::*;
use anchor_spl::token_2022::spl_token_2022::{
    extension::{BaseStateWithExtensions, StateWithExtensions},
    state::Mint as SplMint,
};
use anchor_spl::token_interface::{Mint, Token2022, TokenAccount};
use spl_token_group_interface::state::TokenGroupMember;

declare_id!("7y6F1zyzvoeFuMRCxb5NbMYgaMMvw9iKrPLEPRDacz3z");

/// Seeker Genesis Token group (Token-2022 mint carrying the TokenGroup extension).
pub const SGT_GROUP: Pubkey = pubkey!("GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te");
/// Mint authority of every SGT.
pub const SGT_MINT_AUTHORITY: Pubkey = pubkey!("GT2zuHVaZQYZSyQMgJPLzvkmyztfyXg2NJunqFp4p3A4");

#[program]
pub mod sgt_spike {
    use super::*;

    /// Stand-in for `commit`: gate on the SGT, then create the one-per-mint entry.
    pub fn commit_probe(ctx: Context<CommitProbe>, round_id: u32) -> Result<()> {
        verify_sgt(&ctx.accounts.sgt_mint, &ctx.accounts.sgt_token_account)?;
        let entry = &mut ctx.accounts.entry;
        entry.round_id = round_id;
        entry.sgt_mint = ctx.accounts.sgt_mint.key();
        entry.beneficiary = ctx.accounts.player.key();
        entry.bump = ctx.bumps.entry;
        Ok(())
    }
}

/// Everything the account constraints cannot express. Token program, mint ↔ token account
/// and token owner == signer are enforced by the `#[account]` constraints on `CommitProbe`.
pub fn verify_sgt(
    mint: &InterfaceAccount<Mint>,
    token_account: &InterfaceAccount<TokenAccount>,
) -> Result<()> {
    require!(
        Option::<Pubkey>::from(mint.mint_authority) == Some(SGT_MINT_AUTHORITY),
        SgtError::WrongMintAuthority
    );
    require!(mint.supply == 1, SgtError::WrongSupply);
    require!(mint.decimals == 0, SgtError::WrongDecimals);
    // Real SGT token accounts are frozen; the state is deliberately not checked.
    require!(token_account.amount == 1, SgtError::WrongAmount);

    let info = mint.to_account_info();
    let data = info.try_borrow_data()?;
    let state = StateWithExtensions::<SplMint>::unpack(&data).map_err(|_| SgtError::NotAMint)?;
    let member = state
        .get_extension::<TokenGroupMember>()
        .map_err(|_| SgtError::NotAGroupMember)?;
    require_keys_eq!(
        Pubkey::from(member.group.to_bytes()),
        SGT_GROUP,
        SgtError::WrongGroup
    );
    require_keys_eq!(
        Pubkey::from(member.mint.to_bytes()),
        mint.key(),
        SgtError::MemberMintMismatch
    );
    Ok(())
}

#[derive(Accounts)]
#[instruction(round_id: u32)]
pub struct CommitProbe<'info> {
    #[account(mut)]
    pub player: Signer<'info>,
    #[account(mint::token_program = token_program)]
    pub sgt_mint: InterfaceAccount<'info, Mint>,
    #[account(
        token::mint = sgt_mint,
        token::authority = player,
        token::token_program = token_program,
    )]
    pub sgt_token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(
        init,
        payer = player,
        space = 8 + Entry::INIT_SPACE,
        seeds = [b"entry", round_id.to_le_bytes().as_ref(), sgt_mint.key().as_ref()],
        bump,
    )]
    pub entry: Account<'info, Entry>,
    pub token_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct Entry {
    pub round_id: u32,
    pub sgt_mint: Pubkey,
    pub beneficiary: Pubkey,
    pub bump: u8,
}

#[error_code]
pub enum SgtError {
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
}
