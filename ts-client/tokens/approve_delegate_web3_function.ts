import {
  approveChecked,
  createAssociatedTokenAccount,
  createMint,
  getAccount,
  mintToChecked,
  TOKEN_PROGRAM_ID
} from "@solana/spl-token";
import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";

async function main() {
  // Setup: create a mint and fund the payer's ATA before approving a delegate.
  const connection = new Connection("http://localhost:8899", "confirmed");
  const latestBlockhash = await connection.getLatestBlockhash();

  const feePayer = Keypair.generate();
  const delegate = Keypair.generate();

  const airdropSignature = await connection.requestAirdrop(
    feePayer.publicKey,
    LAMPORTS_PER_SOL
  );
  await connection.confirmTransaction({
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    signature: airdropSignature
  });

  const mintPubkey = await createMint(
    connection,
    feePayer,
    feePayer.publicKey,
    feePayer.publicKey,
    2,
    Keypair.generate(),
    {
      commitment: "confirmed"
    },
    TOKEN_PROGRAM_ID
  );

  const associatedTokenAccount = await createAssociatedTokenAccount(
    connection,
    feePayer,
    mintPubkey,
    feePayer.publicKey,
    {
      commitment: "confirmed"
    },
    TOKEN_PROGRAM_ID
  );

  await mintToChecked(
    connection,
    feePayer,
    mintPubkey,
    associatedTokenAccount,
    feePayer,
    100,
    2,
    [],
    {
      commitment: "confirmed"
    },
    TOKEN_PROGRAM_ID
  );

  const result = await approveChecked(
    connection, // Connection to the local validator.
    feePayer, // Account paying transaction fees.
    mintPubkey, // Mint for the token the delegate may spend.
    associatedTokenAccount, // Token account whose delegate approval changes.
    delegate.publicKey, // Delegate allowed to spend from the token account.
    feePayer, // Owner approving this delegate change.
    25, // Token amount in base units.
    2, // Decimals defined on the mint account.
    [], // Additional multisig signers.
    {
      commitment: "confirmed" // Confirmation options for the transaction.
    },
    TOKEN_PROGRAM_ID // Token program to invoke.
  );

  const tokenAccountData = await getAccount(
    connection,
    associatedTokenAccount,
    "confirmed",
    TOKEN_PROGRAM_ID
  );

  console.log("Mint Address:", mintPubkey.toBase58());
  console.log(
    "\nAssociated Token Account Address:",
    associatedTokenAccount.toBase58()
  );
  console.log("Associated Token Account:", tokenAccountData);
  console.log("\nDelegate Address:", delegate.publicKey.toBase58());
  console.log("\nTransaction Signature:", result);
}

main();