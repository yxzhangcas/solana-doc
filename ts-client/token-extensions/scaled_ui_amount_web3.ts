import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  createInitializeScaledUiAmountConfigInstruction,
  createMintToCheckedInstruction,
  createUpdateMultiplierDataInstruction,
  ExtensionType,
  getAssociatedTokenAddressSync,
  getMint,
  getMintLen,
  getScaledUiAmountConfig,
  TOKEN_2022_PROGRAM_ID
} from "@solana/spl-token";

async function calculateScaledUiAmount(
  connection: Connection,
  mintPublicKey: PublicKey,
  tokenAmount: bigint
) {
  const mintAccount = await getMint(
    connection,
    mintPublicKey,
    "confirmed",
    TOKEN_2022_PROGRAM_ID
  );
  const scaledUiAmountConfig = getScaledUiAmountConfig(mintAccount);
  if (!scaledUiAmountConfig) {
    throw new Error("ScaledUiAmountConfig not found");
  }

  const clockAccount = await connection.getParsedAccountInfo(
    new PublicKey("SysvarC1ock11111111111111111111111111111111")
  );
  if (
    !clockAccount.value ||
    typeof clockAccount.value.data !== "object" ||
    !("parsed" in clockAccount.value.data)
  ) {
    throw new Error("Failed to fetch clock sysvar");
  }

  const unixTimestamp = Number(
    clockAccount.value.data.parsed.info.unixTimestamp
  );
  const multiplier =
    unixTimestamp >=
    Number(scaledUiAmountConfig.newMultiplierEffectiveTimestamp)
      ? scaledUiAmountConfig.newMultiplier
      : scaledUiAmountConfig.multiplier;
  const scaledAmount = Math.trunc(Number(tokenAmount) * multiplier);
  const calculatedUiAmount = scaledAmount / 10 ** mintAccount.decimals;

  return {
    calculatedUiAmount: calculatedUiAmount.toString(),
    scaledUiAmountConfig
  };
}

const connection = new Connection("http://localhost:8899", "confirmed");

const feePayer = Keypair.generate();
const recipient = Keypair.generate();
const initialMultiplier = 5.0;
const updatedMultiplier = 10.0;
const tokenAmount = 1_000n;

const airdropSignature = await connection.requestAirdrop(
  feePayer.publicKey,
  2 * LAMPORTS_PER_SOL
);
await connection.confirmTransaction(airdropSignature, "confirmed");

const mint = Keypair.generate();
const mintLength = getMintLen([ExtensionType.ScaledUiAmountConfig]);
const mintRent = await connection.getMinimumBalanceForRentExemption(mintLength);

const tokenAccount = getAssociatedTokenAddressSync(
  mint.publicKey,
  recipient.publicKey,
  false,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
);

const createMintAccountInstruction = SystemProgram.createAccount({
  fromPubkey: feePayer.publicKey, // Account funding the new mint account.
  newAccountPubkey: mint.publicKey, // New mint account to create.
  space: mintLength, // Account size in bytes for the mint plus ScaledUiAmountConfig.
  lamports: mintRent, // Lamports funding the mint account rent.
  programId: TOKEN_2022_PROGRAM_ID // Program that owns the mint account.
});

const initializeScaledUiAmountInstruction =
  createInitializeScaledUiAmountConfigInstruction(
    mint.publicKey, // Mint account that stores the ScaledUiAmountConfig extension.
    feePayer.publicKey, // Authority allowed to update the multiplier later.
    initialMultiplier, // Initial multiplier used for displayed UI amounts.
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
  new Transaction().add(
    createMintAccountInstruction,
    initializeScaledUiAmountInstruction,
    initializeMintInstruction
  ),
  [feePayer, mint]
);

const createTokenAccountInstruction = createAssociatedTokenAccountInstruction(
  feePayer.publicKey, // Account funding the associated token account creation.
  tokenAccount, // Associated token account address to create.
  recipient.publicKey, // Owner of the token account.
  mint.publicKey, // Mint for the associated token account.
  TOKEN_2022_PROGRAM_ID, // Token program that owns the token account.
  ASSOCIATED_TOKEN_PROGRAM_ID // Associated Token Program that creates the account.
);

const mintToTokenAccountInstruction = createMintToCheckedInstruction(
  mint.publicKey, // Mint account that issues the tokens.
  tokenAccount, // Token account receiving the newly minted tokens.
  feePayer.publicKey, // Signer authorized to mint new tokens.
  tokenAmount, // Token amount in base units.
  0, // Decimals defined on the mint.
  [], // Additional multisig signers.
  TOKEN_2022_PROGRAM_ID // Token program that owns the mint and token account.
);

await sendAndConfirmTransaction(
  connection,
  new Transaction().add(
    createTokenAccountInstruction,
    mintToTokenAccountInstruction
  ),
  [feePayer]
);

const { calculatedUiAmount: calculatedUiAmountBeforeUpdate } =
  await calculateScaledUiAmount(connection, mint.publicKey, tokenAmount);

const updateMultiplierInstruction = createUpdateMultiplierDataInstruction(
  mint.publicKey, // Mint account that stores the ScaledUiAmountConfig extension.
  feePayer.publicKey, // Signer authorized to update the multiplier.
  updatedMultiplier, // New multiplier used for displayed UI amounts.
  0n, // Unix timestamp when the new multiplier takes effect.
  [], // Additional multisig signers.
  TOKEN_2022_PROGRAM_ID // Token program that owns the mint.
);

await sendAndConfirmTransaction(
  connection,
  new Transaction().add(updateMultiplierInstruction),
  [feePayer]
);

const {
  calculatedUiAmount: calculatedUiAmountAfterUpdate,
  scaledUiAmountConfig
} = await calculateScaledUiAmount(connection, mint.publicKey, tokenAmount);

console.log("Mint Address:", mint.publicKey.toBase58());
console.log("Token Account:", tokenAccount.toBase58());
console.log(
  "Calculated UI Amount Before Update:",
  calculatedUiAmountBeforeUpdate
);
console.log(
  "Calculated UI Amount After Update:",
  calculatedUiAmountAfterUpdate
);
console.log("ScaledUiAmountConfig:", scaledUiAmountConfig);