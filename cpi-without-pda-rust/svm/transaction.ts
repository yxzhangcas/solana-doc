import { getTransferSolInstruction, SYSTEM_PROGRAM_ADDRESS, systemProgram } from '@solana-program/system';
import { AccountRole, appendTransactionMessageInstruction, createClient, createTransactionMessage, generateKeyPairSigner, lamports, pipe, setTransactionMessageFeePayerSigner } from '@solana/kit';
import { litesvm } from '@solana/kit-plugin-litesvm';
import { generatedSigner } from '@solana/kit-plugin-signer';

async function main() {
  const client = await createClient().use(generatedSigner()).use(litesvm()).use(systemProgram());
  client.svm.airdrop(client.payer.address, lamports(10_000_000_000n));

  const recipient = await generateKeyPairSigner();

  console.log("before transfer", {
    srcAddress: client.payer.address.toString(),
    srcAmount: client.svm.getBalance(client.payer.address) ?? 0n,
    dstAddress: recipient.address.toString(),
    dstAmount: client.svm.getBalance(recipient.address) ?? 0n,
  });
  await client.sendTransaction([
    getTransferSolInstruction({
      source: client.payer,
      destination: recipient.address,
      amount: lamports(500_000_000n),
    })
  ]);
  console.log("after transfer", {
    srcAddress: client.payer.address.toString(),
    srcAmount: client.svm.getBalance(client.payer.address) ?? 0n,
    dstAddress: recipient.address.toString(),
    dstAmount: client.svm.getBalance(recipient.address) ?? 0n,
  });

  const programId = (await generateKeyPairSigner()).address;
  const path = "target/deploy/cpi_without_pda_rust.so";
  client.svm.addProgramFromFile(programId, path);

  // Create instruction data buffer
  const transferAmount = BigInt(1_000_000_000) / BigInt(2); // 0.5 SOL
  const instructionIndex = 0; // instruction index 0 for SolTransfer enum

  const data = Buffer.alloc(9); // 1 byte for instruction enum + 8 bytes for u64
  data.writeUInt8(instructionIndex, 0); // first byte identifies the instruction
  data.writeBigUInt64LE(transferAmount, 1); // remaining bytes are instruction arguments

  const transactionMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(client.payer, m),
    (m) => appendTransactionMessageInstruction(
      {
        programAddress: programId,
        accounts: [
          { address: client.payer.address, role: AccountRole.WRITABLE_SIGNER },
          { address: recipient.address, role: AccountRole.WRITABLE },
          { address: SYSTEM_PROGRAM_ADDRESS, role: AccountRole.READONLY },
        ],
        data: data
      }, m)
  )
  await client.sendTransaction(transactionMessage)
  console.log("after transfer", {
    srcAddress: client.payer.address.toString(),
    srcAmount: client.svm.getBalance(client.payer.address) ?? 0n,
    dstAddress: recipient.address.toString(),
    dstAmount: client.svm.getBalance(recipient.address) ?? 0n,
  });
}

main();