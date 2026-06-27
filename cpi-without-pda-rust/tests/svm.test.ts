import { SYSTEM_PROGRAM_ADDRESS, systemProgram } from '@solana-program/system';
import { AccountRole, appendTransactionMessageInstruction, createClient, createTransactionMessage, generateKeyPairSigner, lamports, pipe, setTransactionMessageFeePayerSigner } from '@solana/kit';
import { litesvm } from '@solana/kit-plugin-litesvm';
import { generatedSigner } from '@solana/kit-plugin-signer';

test("sol transfer cpi", async () => {
  const client = await createClient().use(generatedSigner()).use(litesvm()).use(systemProgram());

  const programId = (await generateKeyPairSigner()).address;
  const programPath = "target/deploy/cpi_without_pda_rust.so";
  client.svm.addProgramFromFile(programId, programPath);

  // Create sender and recipient
  const sender = await generateKeyPairSigner();
  const recipient = await generateKeyPairSigner();

  // Fund sender
  const amount = BigInt(1_000_000_000n);
  client.svm.airdrop(sender.address, lamports(amount)); // 1 SOL

  // Create instruction data buffer
  const transferAmount = amount / BigInt(2); // 0.5 SOL
  const instructionIndex = 0; // instruction index 0 for SolTransfer enum

  const data = Buffer.alloc(9); // 1 byte for instruction enum + 8 bytes for u64
  data.writeUInt8(instructionIndex, 0); // first byte identifies the instruction
  data.writeBigUInt64LE(transferAmount, 1); // remaining bytes are instruction arguments

  const transactionMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(sender, m),
    (m) => appendTransactionMessageInstruction(
      {
        programAddress: programId,
        accounts: [
          { address: sender.address, role: AccountRole.WRITABLE_SIGNER },
          { address: recipient.address, role: AccountRole.WRITABLE },
          { address: SYSTEM_PROGRAM_ADDRESS, role: AccountRole.READONLY },
        ],
        data: data
      }, m)
  )
  await client.sendTransaction(transactionMessage)

  // Check balances
  const recipientBalance = client.svm.getBalance(recipient.address);
  const senderBalance = client.svm.getBalance(sender.address);

  const transactionFee = BigInt(5000);
  expect(recipientBalance).toBe(transferAmount);
  expect(senderBalance).toBe(amount - transferAmount - transactionFee);
});