use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{AccountInfo, next_account_info},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program::invoke,
    program_error::ProgramError,
    pubkey::Pubkey,
    system_instruction,
    sysvar::{Sysvar, rent::Rent},
};

// Program entrypoint - this is where execution starts
entrypoint!(process_instruction);

/// Main instruction processing function
/// Routes incoming instructions to appropriate handlers
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    // Parse instruction data
    let instruction = CounterInstruction::try_from_slice(instruction_data)
        .map_err(|_| ProgramError::InvalidInstructionData)?;

    // Route to appropriate handler
    match instruction {
        CounterInstruction::InitializeCounter { initial_value } => {
            msg!("Instruction: Initialize Counter");
            process_initialize_counter(program_id, accounts, initial_value)?
        }
        CounterInstruction::IncrementCounter => {
            msg!("Instruction: Increment Counter");
            process_increment_counter(program_id, accounts)?
        }
    };

    Ok(())
}

/// Instructions supported by the counter program
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub enum CounterInstruction {
    /// Initialize a new counter with the given value
    InitializeCounter { initial_value: u64 },

    /// Increment an existing counter by 1
    IncrementCounter,
}

/// Initialize a new counter account
///
/// Accounts expected:
/// 1. `[signer, writable]` Counter account to create
/// 2. `[signer, writable]` Payer account
/// 3. `[]` System Program
fn process_initialize_counter(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    initial_value: u64,
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();

    let counter_account = next_account_info(accounts_iter)?;
    let payer_account = next_account_info(accounts_iter)?;
    let system_program = next_account_info(accounts_iter)?;

    let account_space = 8;
    let rent = Rent::get()?;
    let required_lamports = rent.minimum_balance(account_space);

    // Create account via CPI to System Program
    invoke(
        &system_instruction::create_account(
            payer_account.key,
            counter_account.key,
            required_lamports,
            account_space as u64,
            program_id,
        ),
        &[
            payer_account.clone(),
            counter_account.clone(),
            system_program.clone(),
        ],
    )?;

    // Initialize counter data
    let counter_data = CounterAccount {
        count: initial_value,
    };

    let mut account_data = &mut counter_account.data.borrow_mut()[..];
    counter_data.serialize(&mut account_data)?;

    msg!("Counter initialized with value: {}", initial_value);

    Ok(())
}

/// Increment an existing counter
///
/// Accounts expected:
/// 1. `[writable]` Counter account to increment
fn process_increment_counter(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    let counter_account = next_account_info(accounts_iter)?;

    // Verify ownership
    if counter_account.owner != program_id {
        return Err(ProgramError::IncorrectProgramId);
    }

    // Read, update, write
    let mut data = counter_account.data.borrow_mut();
    let mut counter_data: CounterAccount = CounterAccount::try_from_slice(&data)?;

    counter_data.count = counter_data
        .count
        .checked_add(1)
        .ok_or(ProgramError::InvalidAccountData)?;

    counter_data.serialize(&mut &mut data[..])?;

    msg!("Counter incremented to: {}", counter_data.count);

    Ok(())
}

/// Counter account data structure
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct CounterAccount {
    /// Current counter value
    pub count: u64,
}

#[cfg(test)]
mod test {
    use super::*;
    use litesvm::LiteSVM;
    use solana_sdk::{
        account::ReadableAccount,
        instruction::{AccountMeta, Instruction},
        message::Message,
        signature::{Keypair, Signer},
        system_program,
        transaction::Transaction,
    };

    #[test]
    fn test_counter_program() {
        let mut svm = LiteSVM::new();

        let payer = Keypair::new();
        svm.airdrop(&payer.pubkey(), 1_000_000_000)
            .expect("Failed to airdrop");

        let program_keypair = Keypair::new();
        let program_id = program_keypair.pubkey();
        svm.add_program_from_file(program_id, "target/deploy/counter_program.so")
            .unwrap();

        let counter_keypair = Keypair::new();
        let initial_value: u64 = 42;

        // Step 1: Initialize the counter
        println!("Testing counter initialization...");

        // Use Borsh serialization for the instruction
        let init_instruction_data =
            borsh::to_vec(&CounterInstruction::InitializeCounter { initial_value })
                .expect("Failed to serialize instruction");

        let initialize_instruction = Instruction::new_with_bytes(
            program_id,
            &init_instruction_data,
            vec![
                AccountMeta::new(counter_keypair.pubkey(), true),
                AccountMeta::new(payer.pubkey(), true),
                AccountMeta::new_readonly(system_program::id(), false),
            ],
        );

        let message = Message::new(&[initialize_instruction], Some(&payer.pubkey()));
        let transaction =
            Transaction::new(&[&payer, &counter_keypair], message, svm.latest_blockhash());

        let result = svm.send_transaction(transaction);
        assert!(result.is_ok(), "Initialize transaction should succeed");

        // Check account data
        let account = svm
            .get_account(&counter_keypair.pubkey())
            .expect("Failed to get counter account");

        let counter: CounterAccount = CounterAccount::try_from_slice(account.data())
            .expect("Failed to deserialize counter data");
        assert_eq!(counter.count, 42);
        println!(
            "Counter initialized successfully with value: {}",
            counter.count
        );

        // Step 2: Increment the counter
        println!("Testing counter increment...");

        // Use Borsh serialization for increment instruction
        let increment_data = borsh::to_vec(&CounterInstruction::IncrementCounter)
            .expect("Failed to serialize instruction");

        let increment_instruction = Instruction::new_with_bytes(
            program_id,
            &increment_data,
            vec![AccountMeta::new(counter_keypair.pubkey(), true)],
        );

        // Build and send increment transaction
        let message = Message::new(&[increment_instruction], Some(&payer.pubkey()));
        let transaction =
            Transaction::new(&[&payer, &counter_keypair], message, svm.latest_blockhash());

        let result = svm.send_transaction(transaction);
        assert!(result.is_ok(), "Increment transaction should succeed");

        let logs = result.unwrap().logs;
        println!("Transaction logs:\n{:#?}", logs);

        // Check account data
        let account = svm
            .get_account(&counter_keypair.pubkey())
            .expect("Failed to get counter account");

        let counter: CounterAccount = CounterAccount::try_from_slice(account.data())
            .expect("Failed to deserialize counter data");
        assert_eq!(counter.count, 43);
        println!("Counter incremented successfully to: {}", counter.count);
    }
}
