import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  createMintToCheckedInstruction,
  createTransferCheckedInstruction,
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
  // Setup: create a mint, fund the payer's ATA, and create the recipient's ATA.
  const connection = new Connection("http://localhost:8899", "confirmed");
  const latestBlockhash = await connection.getLatestBlockhash();

  const feePayer = Keypair.generate();
  const recipient = Keypair.generate();

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
  const feePayerATA = getAssociatedTokenAddressSync(
    mint.publicKey,
    feePayer.publicKey,
    false, // allowOwnerOffCurve
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const recipientATA = getAssociatedTokenAddressSync(
    mint.publicKey,
    recipient.publicKey,
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
        feePayerATA,
        feePayer.publicKey,
        mint.publicKey,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      ),
      createAssociatedTokenAccountInstruction(
        feePayer.publicKey,
        recipientATA,
        recipient.publicKey,
        mint.publicKey,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      ),
      createMintToCheckedInstruction(
        mint.publicKey,
        feePayerATA,
        feePayer.publicKey,
        100,
        2,
        [],
        TOKEN_PROGRAM_ID
      )
    ),
    [feePayer, mint]
  );

  const transferBlockhash = await connection.getLatestBlockhash();

  const result = await sendAndConfirmTransaction(
    connection,
    new Transaction({
      feePayer: feePayer.publicKey,
      blockhash: transferBlockhash.blockhash,
      lastValidBlockHeight: transferBlockhash.lastValidBlockHeight
    }).add(
      createTransferCheckedInstruction(
        feePayerATA, // Token account sending the tokens.
        mint.publicKey, // Mint for the token being transferred.
        recipientATA, // Token account receiving the tokens.
        feePayer.publicKey, // Owner or delegate approving the transfer.
        25, // Token amount in base units.
        2, // Decimals defined on the mint account.
        [], // Additional multisig signers.
        TOKEN_PROGRAM_ID // Token program to invoke.
      )
    ),
    [feePayer]
  );

  const senderTokenAccount = await getAccount(
    connection,
    feePayerATA,
    "confirmed",
    TOKEN_PROGRAM_ID
  );
  const recipientTokenAccount = await getAccount(
    connection,
    recipientATA,
    "confirmed",
    TOKEN_PROGRAM_ID
  );

  console.log("Mint Address:", mint.publicKey.toBase58());
  console.log("\nSource Token Account Address:", feePayerATA.toBase58());
  console.log("Source Token Account:", senderTokenAccount);
  console.log("\nDestination Token Account Address:", recipientATA.toBase58());
  console.log("Destination Token Account:", recipientTokenAccount);
  console.log("\nTransaction Signature:", result);
}

main();