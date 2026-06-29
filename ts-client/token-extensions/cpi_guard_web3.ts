import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction
} from "@solana/web3.js";
import {
  createDisableCpiGuardInstruction,
  createEnableCpiGuardInstruction,
  createInitializeAccountInstruction,
  createInitializeMintInstruction,
  ExtensionType,
  getAccountLen,
  getAccount,
  getCpiGuard,
  getMintLen,
  TOKEN_2022_PROGRAM_ID
} from "@solana/spl-token";

const connection = new Connection("http://localhost:8899", "confirmed");
const latestBlockhash = await connection.getLatestBlockhash();

const feePayer = Keypair.generate();
const mint = Keypair.generate();
const tokenAccount = Keypair.generate();

const airdropSignature = await connection.requestAirdrop(
  feePayer.publicKey,
  5 * LAMPORTS_PER_SOL
);
await connection.confirmTransaction({
  blockhash: latestBlockhash.blockhash,
  lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
  signature: airdropSignature
});

const mintSpace = getMintLen([]);
const mintRent = await connection.getMinimumBalanceForRentExemption(mintSpace);

await sendAndConfirmTransaction(
  connection,
  new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: feePayer.publicKey, // Account funding account creation.
      newAccountPubkey: mint.publicKey, // New mint account to create.
      space: mintSpace, // Account size in bytes for the mint account.
      lamports: mintRent, // Lamports funding the mint account rent.
      programId: TOKEN_2022_PROGRAM_ID // Program that owns the mint account.
    }),
    createInitializeMintInstruction(
      mint.publicKey, // Mint account to initialize.
      0, // Number of decimals for the token.
      feePayer.publicKey, // Authority allowed to mint new tokens.
      feePayer.publicKey, // Authority allowed to freeze token accounts.
      TOKEN_2022_PROGRAM_ID // Program that owns the mint account.
    )
  ),
  [feePayer, mint],
  { commitment: "confirmed" }
);

const tokenAccountSpace = getAccountLen([ExtensionType.CpiGuard]);
const tokenAccountRent =
  await connection.getMinimumBalanceForRentExemption(tokenAccountSpace);

await sendAndConfirmTransaction(
  connection,
  new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: feePayer.publicKey, // Account funding account creation.
      newAccountPubkey: tokenAccount.publicKey, // New token account to create.
      space: tokenAccountSpace, // Account size in bytes for the token account plus CpiGuard.
      lamports: tokenAccountRent, // Lamports funding the token account rent.
      programId: TOKEN_2022_PROGRAM_ID // Program that owns the token account.
    }),
    createInitializeAccountInstruction(
      tokenAccount.publicKey, // Token account to initialize.
      mint.publicKey, // Mint for the token account.
      feePayer.publicKey, // Owner allowed to control the token account.
      TOKEN_2022_PROGRAM_ID // Program that owns the token account.
    )
  ),
  [feePayer, tokenAccount],
  { commitment: "confirmed" }
);

await sendAndConfirmTransaction(
  connection,
  new Transaction().add(
    createEnableCpiGuardInstruction(
      tokenAccount.publicKey, // Token account that stores the CpiGuard extension.
      feePayer.publicKey, // Token account owner authorized to enable CPI guard.
      [], // Additional multisig signers.
      TOKEN_2022_PROGRAM_ID // Token program that owns the token account.
    )
  ),
  [feePayer],
  { commitment: "confirmed" }
);

const enabledTokenAccount = await getAccount(
  connection,
  tokenAccount.publicKey,
  "confirmed",
  TOKEN_2022_PROGRAM_ID
);
const enabledCpiGuard = getCpiGuard(enabledTokenAccount);

await sendAndConfirmTransaction(
  connection,
  new Transaction().add(
    createDisableCpiGuardInstruction(
      tokenAccount.publicKey, // Token account that stores the CpiGuard extension.
      feePayer.publicKey, // Token account owner authorized to disable CPI guard.
      [], // Additional multisig signers.
      TOKEN_2022_PROGRAM_ID // Token program that owns the token account.
    )
  ),
  [feePayer],
  { commitment: "confirmed" }
);

const disabledTokenAccount = await getAccount(
  connection,
  tokenAccount.publicKey,
  "confirmed",
  TOKEN_2022_PROGRAM_ID
);
const disabledCpiGuard = getCpiGuard(disabledTokenAccount);

console.log("\nMint Address:", mint.publicKey.toBase58());
console.log("\nToken Account:", tokenAccount.publicKey.toBase58());
console.log("\nEnabled CPI Guard:", enabledCpiGuard);
console.log("\nDisabled CPI Guard:", disabledCpiGuard);