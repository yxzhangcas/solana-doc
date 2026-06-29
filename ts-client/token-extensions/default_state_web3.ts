import {
  Connection,
  Keypair,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";
import {
  AccountState,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createInitializeDefaultAccountStateInstruction,
  createInitializeMintInstruction,
  createUpdateDefaultAccountStateInstruction,
  ExtensionType,
  getAccount,
  getAssociatedTokenAddressSync,
  getDefaultAccountState,
  getMint,
  getMintLen,
  TOKEN_2022_PROGRAM_ID
} from "@solana/spl-token";

const connection = new Connection("http://localhost:8899", "confirmed");
const latestBlockhash = await connection.getLatestBlockhash();

const feePayer = Keypair.generate();

const getTokenAccountStateLabel = (account: {
  isInitialized: boolean;
  isFrozen: boolean;
}) => {
  if (account.isFrozen) return "Frozen";
  if (account.isInitialized) return "Initialized";
  return "Uninitialized";
};

const airdropSignature = await connection.requestAirdrop(
  feePayer.publicKey,
  5 * LAMPORTS_PER_SOL
);
await connection.confirmTransaction({
  blockhash: latestBlockhash.blockhash,
  lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
  signature: airdropSignature
});

const extensions = [ExtensionType.DefaultAccountState];

const mint = Keypair.generate();
const mintLength = getMintLen(extensions);
const mintRent = await connection.getMinimumBalanceForRentExemption(mintLength);

const createMintAccountInstruction = SystemProgram.createAccount({
  fromPubkey: feePayer.publicKey, // Account funding the new mint account.
  newAccountPubkey: mint.publicKey, // New mint account to create.
  space: mintLength, // Account size in bytes for the mint plus DefaultAccountState.
  lamports: mintRent, // Lamports funding the mint account rent.
  programId: TOKEN_2022_PROGRAM_ID // Program that owns the mint account.
});

const initializeDefaultStateInstruction =
  createInitializeDefaultAccountStateInstruction(
    mint.publicKey, // Mint account that stores the DefaultAccountState extension.
    AccountState.Frozen, // Default state assigned to new token accounts.
    TOKEN_2022_PROGRAM_ID // Token program that owns the mint.
  );

const initializeMintInstruction = createInitializeMintInstruction(
  mint.publicKey, // Mint account to initialize.
  0, // Number of decimals for the token.
  feePayer.publicKey, // Authority allowed to mint new tokens.
  feePayer.publicKey, // Authority allowed to freeze token accounts.
  TOKEN_2022_PROGRAM_ID // Program that owns the mint account.
);

await sendAndConfirmTransaction(
  connection,
  new Transaction({
    feePayer: feePayer.publicKey,
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
  }).add(
    createMintAccountInstruction,
    initializeDefaultStateInstruction,
    initializeMintInstruction
  ),
  [feePayer, mint]
);

const tokenAccount = getAssociatedTokenAddressSync(
  mint.publicKey,
  feePayer.publicKey,
  false,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
);

await sendAndConfirmTransaction(
  connection,
  new Transaction().add(
    createAssociatedTokenAccountInstruction(
      feePayer.publicKey, // Account funding the associated token account creation.
      tokenAccount, // Associated token account address to create.
      feePayer.publicKey, // Owner of the token account.
      mint.publicKey, // Mint for the associated token account.
      TOKEN_2022_PROGRAM_ID, // Token program that owns the token account.
      ASSOCIATED_TOKEN_PROGRAM_ID // Associated Token Program that creates the account.
    )
  ),
  [feePayer],
  {
    commitment: "confirmed"
  }
);

const tokenAccountBeforeUpdate = await getAccount(
  connection,
  tokenAccount,
  "confirmed",
  TOKEN_2022_PROGRAM_ID
);
const mintAccountBeforeUpdate = await getMint(
  connection,
  mint.publicKey,
  "confirmed",
  TOKEN_2022_PROGRAM_ID
);
const defaultAccountStateBeforeUpdate = getDefaultAccountState(
  mintAccountBeforeUpdate
);

const updateDefaultStateInstruction =
  createUpdateDefaultAccountStateInstruction(
    mint.publicKey, // Mint account that stores the DefaultAccountState extension.
    AccountState.Initialized, // New default state assigned to later token accounts.
    feePayer.publicKey, // Freeze authority authorized to update the default state.
    [], // Additional multisig signers.
    TOKEN_2022_PROGRAM_ID // Token program that owns the mint.
  );

await sendAndConfirmTransaction(
  connection,
  new Transaction().add(updateDefaultStateInstruction),
  [feePayer],
  {
    commitment: "confirmed"
  }
);

const tokenAccountAfterUpdate = await getAccount(
  connection,
  tokenAccount,
  "confirmed",
  TOKEN_2022_PROGRAM_ID
);
const mintAccountAfterUpdate = await getMint(
  connection,
  mint.publicKey,
  "confirmed",
  TOKEN_2022_PROGRAM_ID
);
const defaultAccountStateAfterUpdate = getDefaultAccountState(
  mintAccountAfterUpdate
);

console.log("Mint Address:", mint.publicKey.toBase58());
console.log(
  "Default Account State Before Update:",
  defaultAccountStateBeforeUpdate
);
console.log(
  "Token Account State Before Update:",
  getTokenAccountStateLabel(tokenAccountBeforeUpdate)
);
console.log(
  "Default Account State After Update:",
  defaultAccountStateAfterUpdate
);
console.log(
  "Token Account State After Update:",
  getTokenAccountStateLabel(tokenAccountAfterUpdate)
);