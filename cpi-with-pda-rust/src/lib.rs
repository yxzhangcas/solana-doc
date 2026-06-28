use borsh::BorshDeserialize;
use solana_program::{
    account_info::AccountInfo, entrypoint, entrypoint::ProgramResult, program::invoke_signed,
    program_error::ProgramError, pubkey::Pubkey, 
};
use solana_system_interface::instruction as system_instruction;

// Declare program entrypoint
entrypoint!(process_instruction);

// Define program instructions
#[derive(BorshDeserialize)]
enum ProgramInstruction {
    SolTransfer { amount: u64 },
}

impl ProgramInstruction {
    fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        Self::try_from_slice(input).map_err(|_| ProgramError::InvalidInstructionData)
    }
}

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    // Deserialize instruction data
    let instruction = ProgramInstruction::unpack(instruction_data)?;

    // Process instruction
    match instruction {
        ProgramInstruction::SolTransfer { amount } => {
            // Parse accounts
            let [pda_account_info, recipient_info, system_program_info] = accounts else {
                return Err(ProgramError::NotEnoughAccountKeys);
            };

            // Derive PDA and verify it matches the account provided by client
            let recipient_pubkey = recipient_info.key;
            let seeds = &[b"pda", recipient_pubkey.as_ref()];
            let (expected_pda, bump_seed) = Pubkey::find_program_address(seeds, program_id);

            if expected_pda != *pda_account_info.key {
                return Err(ProgramError::InvalidArgument);
            }

            // Create the transfer instruction
            let transfer_ix =
                system_instruction::transfer(pda_account_info.key, recipient_info.key, amount);

            // Create signer seeds for PDA
            let signer_seeds: &[&[&[u8]]] = &[&[b"pda", recipient_pubkey.as_ref(), &[bump_seed]]];

            // Invoke the transfer instruction with PDA as signer
            invoke_signed(
                &transfer_ix,
                &[
                    pda_account_info.clone(),
                    recipient_info.clone(),
                    system_program_info.clone(),
                ],
                signer_seeds,
            )?;

            Ok(())
        }
    }
}
