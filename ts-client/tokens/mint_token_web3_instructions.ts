import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  createMintToCheckedInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  getMinimumBalanceForRentExemptMint,
  getMint,
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
  // Setup: create a mint and the payer's ATA before minting tokens.
  const connection = new Connection("http://localhost:8899", "confirmed");
  const latestBlockhash = await connection.getLatestBlockhash();

  const feePayer = Keypair.generate();

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
      )
    ),
    [feePayer, mint]
  );

  const mintBlockhash = await connection.getLatestBlockhash();

  const result = await sendAndConfirmTransaction(
    connection,
    new Transaction({
      feePayer: feePayer.publicKey,
      blockhash: mintBlockhash.blockhash,
      lastValidBlockHeight: mintBlockhash.lastValidBlockHeight
    }).add(
      createMintToCheckedInstruction(
        mint.publicKey, // Mint for the token being minted.
        associatedTokenAccount, // Token account receiving the minted tokens.
        feePayer.publicKey, // Authority allowed to mint new tokens.
        100, // Token amount in base units.
        2, // Decimals defined on the mint account.
        [], // Additional multisig signers.
        TOKEN_PROGRAM_ID // Token program to invoke.
      )
    ),
    [feePayer]
  );

  const mintAccount = await getMint(
    connection,
    mint.publicKey,
    "confirmed",
    TOKEN_PROGRAM_ID
  );
  const tokenAccountData = await getAccount(
    connection,
    associatedTokenAccount,
    "confirmed",
    TOKEN_PROGRAM_ID
  );

  console.log("Mint Address:", mint.publicKey.toBase58());
  console.log("Mint Account:", mintAccount);
  console.log(
    "\nAssociated Token Account Address:",
    associatedTokenAccount.toBase58()
  );
  console.log("Associated Token Account:", tokenAccountData);
  console.log("\nTransaction Signature:", result);
}

main();