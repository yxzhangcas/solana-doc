import {
  Connection,
  Keypair,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";
import {
  createInitializeMintInstruction,
  ExtensionType,
  getMintLen,
  createInitializeMintCloseAuthorityInstruction,
  TOKEN_2022_PROGRAM_ID,
  createCloseAccountInstruction
} from "@solana/spl-token";

const connection = new Connection("http://localhost:8899", "confirmed");
const latestBlockhash = await connection.getLatestBlockhash();

const feePayer = Keypair.generate();

const destination = Keypair.generate();

const airdropSignature = await connection.requestAirdrop(
  feePayer.publicKey,
  5 * LAMPORTS_PER_SOL
);
await connection.confirmTransaction({
  blockhash: latestBlockhash.blockhash,
  lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
  signature: airdropSignature
});

const mint = Keypair.generate();

const extensions = [ExtensionType.MintCloseAuthority];

const mintLength = getMintLen(extensions);

const mintRent = await connection.getMinimumBalanceForRentExemption(mintLength);

const createAccountInstruction = SystemProgram.createAccount({
  fromPubkey: feePayer.publicKey,
  newAccountPubkey: mint.publicKey,
  space: mintLength,
  lamports: mintRent,
  programId: TOKEN_2022_PROGRAM_ID
});

const initializeMintCloseAuthorityInstruction =
  createInitializeMintCloseAuthorityInstruction(
    mint.publicKey, // Mint account that stores the MintCloseAuthority extension.
    feePayer.publicKey, // Authority allowed to close the mint.
    TOKEN_2022_PROGRAM_ID // Token program that owns the mint.
  );

const initializeMintInstruction = createInitializeMintInstruction(
  mint.publicKey, // mint pubkey
  9, // decimals
  feePayer.publicKey, // mint authority
  feePayer.publicKey, // freeze authority
  TOKEN_2022_PROGRAM_ID
);

const transaction = new Transaction({
  feePayer: feePayer.publicKey,
  blockhash: latestBlockhash.blockhash,
  lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
}).add(
  createAccountInstruction,
  initializeMintCloseAuthorityInstruction,
  initializeMintInstruction
);

const transactionSignature = await sendAndConfirmTransaction(
  connection,
  transaction,
  [feePayer, mint]
);

console.log("Mint Address:", mint.publicKey.toBase58());
console.log("Transaction Signature:", transactionSignature);

const latestBlockhash2 = await connection.getLatestBlockhash();

const closeMintInstruction = createCloseAccountInstruction(
  mint.publicKey, // Mint account to close.
  destination.publicKey, // Account receiving the reclaimed lamports.
  feePayer.publicKey, // Close authority signing the instruction.
  [], // Additional multisig signers.
  TOKEN_2022_PROGRAM_ID // Token program that owns the mint.
);

const closeMintTransaction = new Transaction({
  feePayer: feePayer.publicKey,
  blockhash: latestBlockhash2.blockhash,
  lastValidBlockHeight: latestBlockhash2.lastValidBlockHeight
}).add(closeMintInstruction);

const transactionSignature3 = await sendAndConfirmTransaction(
  connection,
  closeMintTransaction,
  [feePayer]
);

console.log("\nDestination Address:", destination.publicKey.toBase58());
console.log("Transaction Signature:", transactionSignature3);