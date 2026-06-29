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
  amountToUiAmountForMintWithoutSimulation,
  createAmountToUiAmountInstruction,
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  createInitializeInterestBearingMintInstruction,
  createMintToCheckedInstruction,
  createUpdateRateInterestBearingMintInstruction,
  ExtensionType,
  getAssociatedTokenAddressSync,
  getInterestBearingMintConfigState,
  getMint,
  getMintLen,
  TOKEN_2022_PROGRAM_ID
} from "@solana/spl-token";

const connection = new Connection("http://localhost:8899", "confirmed");
const latestBlockhash = await connection.getLatestBlockhash();

const feePayer = Keypair.generate();
const recipient = Keypair.generate();
const tokenAmount = 1_000_000_000_000n;

const airdropSignature = await connection.requestAirdrop(
  feePayer.publicKey,
  5 * LAMPORTS_PER_SOL
);
await connection.confirmTransaction({
  blockhash: latestBlockhash.blockhash,
  lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
  signature: airdropSignature
});

const extensions = [ExtensionType.InterestBearingConfig];

const mint = Keypair.generate();

const mintLength = getMintLen(extensions);

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
  space: mintLength, // Account size in bytes for the mint plus InterestBearingConfig.
  lamports: mintRent, // Lamports funding the mint account rent.
  programId: TOKEN_2022_PROGRAM_ID // Program that owns the mint account.
});

const initializeInterestBearingInstruction =
  createInitializeInterestBearingMintInstruction(
    mint.publicKey, // Mint account that stores the InterestBearingConfig extension.
    feePayer.publicKey, // Authority allowed to update the interest rate later.
    30000, // Interest rate in basis points.
    TOKEN_2022_PROGRAM_ID // Token program that owns the mint.
  );

const initializeMintInstruction = createInitializeMintInstruction(
  mint.publicKey, // Mint account to initialize.
  0, // Number of decimals for the token.
  feePayer.publicKey, // Authority allowed to mint new tokens.
  feePayer.publicKey, // Authority allowed to freeze token accounts.
  TOKEN_2022_PROGRAM_ID // Program that owns the mint account.
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
  new Transaction({
    feePayer: feePayer.publicKey,
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
  }).add(
    createMintAccountInstruction,
    initializeInterestBearingInstruction,
    initializeMintInstruction
  ),
  [feePayer, mint]
);

await sendAndConfirmTransaction(
  connection,
  new Transaction().add(
    createTokenAccountInstruction,
    mintToTokenAccountInstruction
  ),
  [feePayer]
);

await new Promise((resolve) => setTimeout(resolve, 2_000));

const calculatedUiAmount = await amountToUiAmountForMintWithoutSimulation(
  connection,
  mint.publicKey,
  tokenAmount
);

const amountToUiInstruction = createAmountToUiAmountInstruction(
  mint.publicKey, // Mint whose UI amount conversion is being simulated.
  tokenAmount, // Token amount in base units.
  TOKEN_2022_PROGRAM_ID // Token program that owns the mint.
);

const amountToUiSimulation = await connection.simulateTransaction(
  new Transaction().add(amountToUiInstruction),
  [feePayer],
  false
);
const simulatedUiAmount = Buffer.from(
  amountToUiSimulation.value.returnData?.data?.[0] ?? "",
  "base64"
).toString("utf8");

const updateRateInstruction = createUpdateRateInterestBearingMintInstruction(
  mint.publicKey, // Mint account that stores the InterestBearingConfig extension.
  feePayer.publicKey, // Signer authorized to update the interest rate.
  15000, // New interest rate in basis points.
  [], // Additional multisig signers.
  TOKEN_2022_PROGRAM_ID // Token program that owns the mint.
);

await sendAndConfirmTransaction(
  connection,
  new Transaction().add(updateRateInstruction),
  [feePayer]
);

const mintAccount = await getMint(
  connection,
  mint.publicKey,
  "confirmed",
  TOKEN_2022_PROGRAM_ID
);
const interestBearingConfig = getInterestBearingMintConfigState(mintAccount);

console.log("Mint Address:", mint.publicKey.toBase58());
console.log("Token Account:", tokenAccount.toBase58());
console.log("Calculated UI Amount:", calculatedUiAmount);
console.log("Simulated UI Amount:", simulatedUiAmount);
console.log("InterestBearingConfig:", interestBearingConfig);