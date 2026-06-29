import {
  createAssociatedTokenAccount,
  getAccount,
  NATIVE_MINT,
  syncNative,
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
  // Setup: create a WSOL ATA and transfer SOL into the WSOL ATA before calling SyncNative.
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

  const associatedTokenAccount = await createAssociatedTokenAccount(
    connection,
    feePayer,
    NATIVE_MINT,
    feePayer.publicKey,
    {
      commitment: "confirmed"
    },
    TOKEN_PROGRAM_ID
  );

  await sendAndConfirmTransaction(
    connection,
    new Transaction({
      feePayer: feePayer.publicKey,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
    }).add(
      SystemProgram.transfer({
        fromPubkey: feePayer.publicKey, // Account sending the SOL to wrap.
        toPubkey: associatedTokenAccount, // WSOL token account receiving the SOL.
        lamports: 1_000_000 // SOL amount in lamports.
      })
    ),
    [feePayer]
  );

  const result = await syncNative(
    connection,
    feePayer, // Account paying transaction fees.
    associatedTokenAccount, // WSOL token account to synchronize.
    {
      commitment: "confirmed"
    },
    TOKEN_PROGRAM_ID // Token program to invoke.
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