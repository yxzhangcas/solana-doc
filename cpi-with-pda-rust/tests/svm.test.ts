import { SYSTEM_PROGRAM_ADDRESS, systemProgram } from '@solana-program/system';
import { AccountRole, appendTransactionMessageInstruction, createClient, createTransactionMessage, generateKeyPairSigner, getAddressEncoder, getProgramDerivedAddress, lamports, pipe, setTransactionMessageFeePayerSigner } from '@solana/kit';
import { litesvm } from '@solana/kit-plugin-litesvm';
import { generatedSigner } from '@solana/kit-plugin-signer';

test("sol transfer cpi with pda signer", async () => {
  const client = await createClient().use(generatedSigner()).use(litesvm()).use(systemProgram());

  const programId = (await generateKeyPairSigner()).address;
  const programPath = "target/deploy/cpi_with_pda_rust.so";
  client.svm.addProgramFromFile(programId, programPath);

  // Create recipient
  const recipient = await generateKeyPairSigner();

  // Derive PDA that will hold and send funds
  const [pdaAddress] = await getProgramDerivedAddress({
    programAddress: programId,
    seeds: [Buffer.from("pda"), getAddressEncoder().encode(recipient.address)]
  });

  // Fund accounts
  const amount = BigInt(1_000_000_000);
  client.svm.airdrop(recipient.address, lamports(amount)); // 1 SOL
  client.svm.airdrop(pdaAddress, lamports(amount)); // 1 SOL

  // Create instruction data buffer
  const transferAmount = amount / BigInt(2); // 0.5 SOL
  const instructionIndex = 0; // instruction index 0 for SolTransfer enum

  const data = Buffer.alloc(9); // 1 byte for instruction enum + 8 bytes for u64
  data.writeUInt8(instructionIndex, 0); // first byte identifies the instruction
  data.writeBigUInt64LE(transferAmount, 1); // remaining bytes are instruction arguments

  const transactionMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(recipient, m),
    (m) => appendTransactionMessageInstruction(
      {
        programAddress: programId,
        accounts: [
          { address: pdaAddress, role: AccountRole.WRITABLE },
          { address: recipient.address, role: AccountRole.WRITABLE },
          { address: SYSTEM_PROGRAM_ADDRESS, role: AccountRole.READONLY },
        ],
        data: data
      }, m)
  );
  await client.sendTransaction(transactionMessage)

  // Check balances
  const recipientBalance = client.svm.getBalance(recipient.address);
  const pdaBalance = client.svm.getBalance(pdaAddress);

  const transactionFee = BigInt(5000);
  // Recipient starts with 1 SOL, receives 0.5 SOL, pays tx fee
  expect(recipientBalance).toBe(amount + transferAmount - transactionFee);
  // PDA starts with 1 SOL, sends 0.5 SOL
  expect(pdaBalance).toBe(amount - transferAmount);
});