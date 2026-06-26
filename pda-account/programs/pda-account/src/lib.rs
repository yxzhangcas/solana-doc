use anchor_lang::prelude::*;

declare_id!("57CfeK7LBUe2rAsRDWhrRdhQvY13qoS8ph8o4wuKRmty");

#[program]
pub mod pda_account {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let account_data = &mut ctx.accounts.pda_account;
        // store the address of the `user`
        account_data.user = *ctx.accounts.user.key;
        // store the canonical bump
        account_data.bump = ctx.bumps.pda_account;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        init,
        payer = user,
        space = 8 + DataAccount::INIT_SPACE, // 8 bytes for Anchor account discriminator
        // define the seeds to derive the PDA
        seeds = [b"data", user.key().as_ref()],
        // use the canonical bump
        bump,
    )]
    pub pda_account: Account<'info, DataAccount>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct DataAccount {
    pub user: Pubkey,
    pub bump: u8,
}
