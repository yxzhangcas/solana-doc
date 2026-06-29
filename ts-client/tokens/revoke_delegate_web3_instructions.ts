import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createApproveCheckedInstruction,
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  createMintToCheckedInstruction,
  createRevokeInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
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
  // Setup: create a mint, fund the payer's ATA, and approve a delegate first.
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

  const mint = Keypair.generate();
  const mintRent = await getMinimumBalanceForRentExemptMint(connection);
  const associatedTokenAccount = getAssociatedTokenAddressSync(
    mint.publicKey,
    feePayer.publicKey,
    false, // allowOwnerOffCurve
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
      SystemProgram.createAccount({
        fromPubkey: feePayer.publicKey,
        newAccountPubkey: mint.publicKey,
        space: MINT_SIZE,
        lamports: mintRent,
        programId: TOKEN_PROGRAM_ID
      }),
      createInitializeMintInstruction(
        mint.publicKey,
        2,
        feePayer.publicKey,
        feePayer.publicKey,
        TOKEN_PROGRAM_ID
      ),
      createAssociatedTokenAccountInstruction(
        feePayer.publicKey,
        associatedTokenAccount,
        feePayer.publicKey,
        mint.publicKey,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      ),
      createMintToCheckedInstruction(
        mint.publicKey,
        associatedTokenAccount,
        feePayer.publicKey,
        100,
        2,
        [],
        TOKEN_PROGRAM_ID
      ),
      createApproveCheckedInstruction(
        associatedTokenAccount,
        mint.publicKey,
        delegate.publicKey,
        feePayer.publicKey,
        25,
        2,
        [],
        TOKEN_PROGRAM_ID
      )
    ),
    [feePayer, mint]
  );

  const revokeBlockhash = await connection.getLatestBlockhash();

  const result = await sendAndConfirmTransaction(
    connection,
    new Transaction({
      feePayer: feePayer.publicKey,
      blockhash: revokeBlockhash.blockhash,
      lastValidBlockHeight: revokeBlockhash.lastValidBlockHeight
    }).add(
      createRevokeInstruction(
        associatedTokenAccount, // Token account whose delegate approval changes.
        feePayer.publicKey, // Owner approving this delegate change.
        [], // Additional multisig signers.
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

  console.log("Mint Address:", mint.publicKey.toBase58());
  console.log(
    "\nAssociated Token Account Address:",
    associatedTokenAccount.toBase58()
  );
  console.log("Associated Token Account:", tokenAccountData);
  console.log("\nDelegate Address:", delegate.publicKey.toBase58());
  console.log("\nTransaction Signature:", result);
}

main();