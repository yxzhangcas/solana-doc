import {
  Connection,
  Keypair,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";
import {
  AuthorityType,
  createInitializeMintInstruction,
  createInitializeAccountInstruction,
  createInitializeImmutableOwnerInstruction,
  createSetAuthorityInstruction,
  ExtensionType,
  getAccount,
  getAccountLen,
  getImmutableOwner,
  getMintLen,
  TOKEN_2022_PROGRAM_ID
} from "@solana/spl-token";

const connection = new Connection("http://localhost:8899", "confirmed");
const feePayer = Keypair.generate();
const newOwner = Keypair.generate();

const airdropSignature = await connection.requestAirdrop(
  feePayer.publicKey,
  5 * LAMPORTS_PER_SOL
);
const latestBlockhash = await connection.getLatestBlockhash();
await connection.confirmTransaction({
  blockhash: latestBlockhash.blockhash,
  lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
  signature: airdropSignature
});

const mint = Keypair.generate();

const mintLength = getMintLen([]);

const mintRent = await connection.getMinimumBalanceForRentExemption(mintLength);

const extensions = [ExtensionType.ImmutableOwner];
const tokenAccount = new Keypair();
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
  TOKEN_2022_PROGRAM_ID // Program that owns the mint account.
);

const createTokenAccountInstruction = SystemProgram.createAccount({
  fromPubkey: feePayer.publicKey, // Account funding the new token account.
  newAccountPubkey: tokenAccount.publicKey, // New token account to create.
  space: tokenAccountLen, // Account size in bytes for the token account plus ImmutableOwner.
  lamports: tokenAccountRent, // Lamports funding the token account rent.
  programId: TOKEN_2022_PROGRAM_ID // Program that owns the token account.
});

const initializeImmutableOwnerInstruction =
  createInitializeImmutableOwnerInstruction(
    tokenAccount.publicKey, // Token account that stores the ImmutableOwner extension.
    TOKEN_2022_PROGRAM_ID // Token program that owns the token account.
  );

const initializeTokenAccountInstruction = createInitializeAccountInstruction(
  tokenAccount.publicKey, // Token account to initialize.
  mint.publicKey, // Mint for the token account.
  feePayer.publicKey, // Owner of the token account.
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
    createTokenAccountInstruction,
    initializeImmutableOwnerInstruction,
    initializeTokenAccountInstruction
  ),
  [feePayer, tokenAccount]
);

let failure: string | undefined;
try {
  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(
      createSetAuthorityInstruction(
        tokenAccount.publicKey, // Token account whose authority is being updated.
        feePayer.publicKey, // Current token account owner signing the instruction.
        AuthorityType.AccountOwner, // Account authority field to change.
        newOwner.publicKey, // New token account owner to set.
        [], // Additional multisig signers.
        TOKEN_2022_PROGRAM_ID // Token program that owns the token account.
      )
    ),
    [feePayer]
  );
} catch (error) {
  failure = String(error);
}
if (!failure) {
  throw new Error("Expected the owner change to fail");
}

const tokenAccountData = await getAccount(
  connection,
  tokenAccount.publicKey,
  "confirmed",
  TOKEN_2022_PROGRAM_ID
);
const immutableOwnerExtension = getImmutableOwner(tokenAccountData);

console.log("Mint Address:", mint.publicKey.toBase58());
console.log("Token Account:", tokenAccount.publicKey.toBase58());
console.log("ImmutableOwner Extension:", immutableOwnerExtension);
console.log("SetAuthority Failure:", failure);