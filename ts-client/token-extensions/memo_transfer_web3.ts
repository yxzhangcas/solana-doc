import {
  Connection,
  Keypair,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createDisableRequiredMemoTransfersInstruction,
  createEnableRequiredMemoTransfersInstruction,
  createInitializeAccountInstruction,
  createInitializeMintInstruction,
  getAccount,
  getAccountLen,
  getMemoTransfer,
  createMintToCheckedInstruction,
  createTransferCheckedInstruction,
  ExtensionType,
  getMintLen,
  TOKEN_2022_PROGRAM_ID
} from "@solana/spl-token";
import { createMemoInstruction } from "@solana/spl-memo";

const connection = new Connection("http://localhost:8899", "confirmed");

const feePayer = Keypair.generate();
const tokenOwner = Keypair.generate();
const tokenAmount = 1;

const airdropSignature = await connection.requestAirdrop(
  feePayer.publicKey,
  5 * LAMPORTS_PER_SOL
);
await connection.confirmTransaction(airdropSignature, "confirmed");

const mint = Keypair.generate();

const mintLength = getMintLen([]);

const mintRent = await connection.getMinimumBalanceForRentExemption(mintLength);
const extensions = [ExtensionType.MemoTransfer];
const tokenAccount = Keypair.generate();
const tokenAccountLen = getAccountLen(extensions);
const tokenAccountRent =
  await connection.getMinimumBalanceForRentExemption(tokenAccountLen);

const createMintAccountInstruction = SystemProgram.createAccount({
  fromPubkey: feePayer.publicKey, // Account funding the new mint account.
  newAccountPubkey: mint.publicKey, // New mint account to create.
  space: mintLength, // Account size in bytes for the mint.
  lamports: mintRent, // Lamports funding the mint account rent.
  programId: TOKEN_2022_PROGRAM_ID // Program that owns the mint account.
});

const initializeMintInstruction = createInitializeMintInstruction(
  mint.publicKey, // Mint account to initialize.
  0, // Number of decimals for the token.
  feePayer.publicKey, // Authority allowed to mint new tokens.
  feePayer.publicKey, // Authority allowed to freeze token accounts.
  TOKEN_2022_PROGRAM_ID // Token program that owns the mint account.
);

const sourceToken = getAssociatedTokenAddressSync(
  mint.publicKey, // Mint for the source token account.
  feePayer.publicKey, // Owner of the source token account.
  false, // Whether the owner is a PDA.
  TOKEN_2022_PROGRAM_ID, // Token program that owns the token account.
  ASSOCIATED_TOKEN_PROGRAM_ID // Associated Token Program that derives the ATA.
);

const createSourceTokenInstruction = createAssociatedTokenAccountInstruction(
  feePayer.publicKey, // Account funding the associated token account creation.
  sourceToken, // Associated token account address to create.
  feePayer.publicKey, // Owner of the associated token account.
  mint.publicKey, // Mint for the associated token account.
  TOKEN_2022_PROGRAM_ID, // Token program that owns the token account.
  ASSOCIATED_TOKEN_PROGRAM_ID // Associated Token Program that creates the account.
);

const mintToInstruction = createMintToCheckedInstruction(
  mint.publicKey, // Mint account that issues the tokens.
  sourceToken, // Token account receiving the newly minted tokens.
  feePayer.publicKey, // Signer authorized to mint new tokens.
  tokenAmount, // Token amount in base units.
  0, // Decimals defined on the mint.
  [], // Additional multisig signers.
  TOKEN_2022_PROGRAM_ID // Token program that owns the mint and token account.
);

const createTokenAccountInstruction = SystemProgram.createAccount({
  fromPubkey: feePayer.publicKey, // Account funding the new token account.
  newAccountPubkey: tokenAccount.publicKey, // New token account to create.
  space: tokenAccountLen, // Account size in bytes for the token account plus MemoTransfer.
  lamports: tokenAccountRent, // Lamports funding the token account rent.
  programId: TOKEN_2022_PROGRAM_ID // Program that owns the token account.
});

const initializeTokenAccountInstruction = createInitializeAccountInstruction(
  tokenAccount.publicKey, // Token account to initialize.
  mint.publicKey, // Mint for the token account.
  tokenOwner.publicKey, // Owner of the token account.
  TOKEN_2022_PROGRAM_ID // Token program that owns the token account.
);

await sendAndConfirmTransaction(
  connection,
  new Transaction().add(
    createMintAccountInstruction,
    initializeMintInstruction
  ),
  [feePayer, mint]
);

await sendAndConfirmTransaction(
  connection,
  new Transaction().add(
    createSourceTokenInstruction,
    mintToInstruction,
    createTokenAccountInstruction,
    initializeTokenAccountInstruction
  ),
  [feePayer, tokenAccount]
);

const enableMemoTransferExtensionInstruction =
  createEnableRequiredMemoTransfersInstruction(
    tokenAccount.publicKey, // Token account that stores the MemoTransfer extension.
    tokenOwner.publicKey, // Token account owner authorized to toggle memo requirements.
    [], // Additional multisig signers.
    TOKEN_2022_PROGRAM_ID // Token program that owns the token account.
  );

await sendAndConfirmTransaction(
  connection,
  new Transaction().add(enableMemoTransferExtensionInstruction),
  [feePayer, tokenOwner]
);

const memoIx = createMemoInstruction(
  "memo required", // Memo string required by the destination token account.
  [feePayer.publicKey] // Accounts to include in the memo instruction.
);

const transferInstruction = createTransferCheckedInstruction(
  sourceToken, // Token account sending the transfer.
  mint.publicKey, // Mint for the transfer.
  tokenAccount.publicKey, // Token account receiving the transfer.
  feePayer.publicKey, // Owner of the source token account.
  tokenAmount, // Token amount in base units.
  0, // Decimals defined on the mint.
  [], // Additional multisig signers.
  TOKEN_2022_PROGRAM_ID // Token program that processes the transfer.
);

await sendAndConfirmTransaction(
  connection,
  new Transaction().add(memoIx, transferInstruction),
  [feePayer]
);

const disableMemoTransferExtensionInstruction =
  createDisableRequiredMemoTransfersInstruction(
    tokenAccount.publicKey, // Token account that stores the MemoTransfer extension.
    tokenOwner.publicKey, // Token account owner authorized to toggle memo requirements.
    [], // Additional multisig signers.
    TOKEN_2022_PROGRAM_ID // Token program that owns the token account.
  );

await sendAndConfirmTransaction(
  connection,
  new Transaction().add(disableMemoTransferExtensionInstruction),
  [feePayer, tokenOwner]
);

const tokenAccountData = await getAccount(
  connection,
  tokenAccount.publicKey,
  "confirmed",
  TOKEN_2022_PROGRAM_ID
);
const memoTransferExtension = getMemoTransfer(tokenAccountData);

console.log("Mint Address:", mint.publicKey.toBase58());
console.log("Token Account:", tokenAccount.publicKey.toBase58());
console.log("Destination Amount:", tokenAccountData.amount.toString());
console.log("MemoTransfer Extension:", memoTransferExtension);