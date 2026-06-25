use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

declare_id!("Bv5oZet7pWd11X69bzhVGsaXNcpypvTDuJLySbJpHPVx");

#[program]
pub mod cpi {
    use super::*;

    pub fn create(ctx: Context<Create>, message: String) -> Result<()> {
        msg!("Create Message: {}", message);
        ctx.accounts.message_account.user = ctx.accounts.user.key();
        ctx.accounts.message_account.message = message;
        ctx.accounts.message_account.bump = ctx.bumps.message_account;
        Ok(())
    }
    pub fn update(ctx: Context<Update>, message: String) -> Result<()> {
        msg!("Update Message: {}", message);
        ctx.accounts.message_account.message = message;
        let transfer_accounts = Transfer {
            from: ctx.accounts.user.to_account_info(),
            to: ctx.accounts.vault_account.to_account_info(),
        };
        let cpi_context = CpiContext::new(ctx.accounts.system_program.key(), transfer_accounts);
        transfer(cpi_context, 1_000_000)?;
        Ok(())
    }
    pub fn delete(ctx: Context<Delete>) -> Result<()> {
        msg!("Delete Message");
        let user_key = ctx.accounts.user.key();
        let signer_seeds: &[&[&[u8]]] =
            &[&[b"vault", user_key.as_ref(), &[ctx.bumps.vault_account]]];
        let transfer_accounts = Transfer {
            from: ctx.accounts.vault_account.to_account_info(),
            to: ctx.accounts.user.to_account_info(),
        };
        let cpi_context = CpiContext::new(ctx.accounts.system_program.key(), transfer_accounts)
            .with_signer(signer_seeds);
        transfer(cpi_context, ctx.accounts.vault_account.lamports())?; // 任意账户都能进行删除
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(message: String)]
pub struct Create<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        init,
        payer = user,
        space = 8 + 32 + 4 + message.len() + 1, // discriminator(8), pubkey(32), strlen(4), string(len), bump(1)
        seeds = [b"message", user.key().as_ref()],
        bump,
    )]
    pub message_account: Account<'info, MessageAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(message: String)]
pub struct Update<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        realloc = 8 + 32 + 4 + message.len() + 1,
        realloc::payer = user,  // 可以重新分配空间
        realloc::zero = true,
        seeds = [b"message", user.key().as_ref()],
        bump = message_account.bump,
    )]
    pub message_account: Account<'info, MessageAccount>,
    #[account(
        mut,
        seeds = [b"vault", user.key().as_ref()],
        bump,
    )]
    pub vault_account: SystemAccount<'info>, // 程序控制的主账户（SOL账户），无需创建，无需销毁
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Delete<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        close = user,
        seeds = [b"message", user.key().as_ref()],
        bump = message_account.bump,
    )]
    pub message_account: Account<'info, MessageAccount>,
    #[account(
        mut,
        seeds = [b"vault", user.key().as_ref()],
        bump,
    )]
    pub vault_account: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct MessageAccount {
    pub user: Pubkey,
    pub message: String,
    pub bump: u8,
}
