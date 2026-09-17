//! Spike 1: does a posted Pyth update satisfy the "first update at or after T" rule
//! from docs/01-PROGRAM.md (set_reference / resolve)? Throwaway code, not the product.
use anchor_lang::prelude::*;
use pyth_solana_receiver_sdk::price_update::{PriceUpdateV2, VerificationLevel};

declare_id!("CvygcyyJavsRaVGGMg4trsWFTADVhcwrJsYuSboHzsEw");

pub const WINDOW_SECS: i64 = 60;

#[program]
pub mod pyth_spike {
    use super::*;

    /// Validates `price_update` as the first update at or after `t` and logs its values.
    pub fn check_first_after(
        ctx: Context<CheckFirstAfter>,
        feed_id: [u8; 32],
        t: i64,
        max_conf_bps: u16,
    ) -> Result<()> {
        let update = &ctx.accounts.price_update;
        require!(
            update.verification_level == VerificationLevel::Full,
            SpikeError::NotFullyVerified
        );

        let m = &update.price_message;
        require!(m.feed_id == feed_id, SpikeError::WrongFeed);
        require!(m.prev_publish_time < t, SpikeError::NotFirstAfter);
        require!(t <= m.publish_time, SpikeError::BeforeT);
        let latest = t.checked_add(WINDOW_SECS).ok_or(SpikeError::Overflow)?;
        require!(m.publish_time <= latest, SpikeError::OutsideWindow);
        require!(m.price > 0, SpikeError::NonPositivePrice);

        // conf * 10_000 / price <= max_conf_bps, in u128
        let price = u128::try_from(m.price).map_err(|_| SpikeError::Overflow)?;
        let conf_scaled = u128::from(m.conf)
            .checked_mul(10_000)
            .ok_or(SpikeError::Overflow)?;
        let conf_bps = conf_scaled.checked_div(price).ok_or(SpikeError::Overflow)?;
        require!(
            conf_bps <= u128::from(max_conf_bps),
            SpikeError::ConfidenceTooWide
        );

        msg!(
            "ok: price={} expo={} conf={} conf_bps={} publish_time={} prev_publish_time={} t={}",
            m.price,
            m.exponent,
            m.conf,
            conf_bps,
            m.publish_time,
            m.prev_publish_time,
            t
        );
        Ok(())
    }
}

#[derive(Accounts)]
pub struct CheckFirstAfter<'info> {
    /// Owner (Pyth receiver program) and discriminator are checked by `Account`.
    pub price_update: Account<'info, PriceUpdateV2>,
}

#[error_code]
pub enum SpikeError {
    #[msg("price update is not fully verified")]
    NotFullyVerified,
    #[msg("feed id does not match")]
    WrongFeed,
    #[msg("prev_publish_time >= t: not the first update after t")]
    NotFirstAfter,
    #[msg("publish_time < t")]
    BeforeT,
    #[msg("publish_time > t + 60 s")]
    OutsideWindow,
    #[msg("price <= 0")]
    NonPositivePrice,
    #[msg("confidence interval too wide")]
    ConfidenceTooWide,
    #[msg("arithmetic overflow")]
    Overflow,
}
