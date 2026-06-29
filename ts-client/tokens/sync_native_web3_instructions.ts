import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction
} from "@solana/web3.js";

async function main() {
  // Setup: create a WSOL ATA before wrapping and syncing SOL.
  const connection = new Connection("http://localhost:8899", "confirmed");
  const latestBlockhash = await connection.getLatestBlockhash();

  const feePayer = Keypair.generate();

  const airdropSignature = await connection.requestAirdrop(
    feePayer.publicKey,
    2 * LAMPORTS_PER_SOL
  );
  await connection.confirmTransaction({
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    signature: airdropSignature
  });

  const associatedTokenAccount = getAssociatedTokenAddressSync(
    NATIVE_MINT,
    feePayer.publicKey,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  await sendAndConfirmTransaction(
    connection,
    new Transaction({
      feePayer: feePayer.publicKey,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
    }).add(
      createAssociatedTokenAccountInstruction(
        feePayer.publicKey,
        associatedTokenAccount,
        feePayer.publicKey,
        NATIVE_MINT,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    ),
    [feePayer]
  );

  const syncBlockhash = await connection.getLatestBlockhash();
  const result = await sendAndConfirmTransaction(
    connection,
    new Transaction({
      feePayer: feePayer.publicKey,
      blockhash: syncBlockhash.blockhash,
      lastValidBlockHeight: syncBlockhash.lastValidBlockHeight
    }).add(
      SystemProgram.transfer({
        fromPubkey: feePayer.publicKey, // Account sending the SOL to wrap.
        toPubkey: associatedTokenAccount, // WSOL token account receiving the SOL.
        lamports: 1_000_000 // SOL amount in lamports.
      }),
      createSyncNativeInstruction(
        associatedTokenAccount, // WSOL token account to synchronize.
        TOKEN_PROGRAM_ID // Token program to invoke.
      )
    ),
    [feePayer]
  );

  const tokenAccountData = await getAccount(
    connection,
    associatedTokenAccount,
    "confirmed",
    TOKEN_PROGRAM_ID
  );

  console.log("WSOL Token Account Address:", associatedTokenAccount.toBase58());
  console.log("WSOL Token Account:", tokenAccountData);
  console.log("\nTransaction Signature:", result);
}

main();