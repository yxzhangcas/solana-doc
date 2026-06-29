import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  createInitializePausableConfigInstruction,
  createMintToCheckedInstruction,
  createPauseInstruction,
  createResumeInstruction,
  createTransferCheckedInstruction,
  ExtensionType,
  getAssociatedTokenAddressSync,
  getMint,
  getMintLen,
  getPausableConfig,
  TOKEN_2022_PROGRAM_ID
} from "@solana/spl-token";

const connection = new Connection("http://localhost:8899", "confirmed");
const latestBlockhash = await connection.getLatestBlockhash();

const feePayer = Keypair.generate();
const mint = Keypair.generate();
const recipient = Keypair.generate();

const airdropSignature = await connection.requestAirdrop(
  feePayer.publicKey,
  5 * LAMPORTS_PER_SOL
);
await connection.confirmTransaction({
  blockhash: latestBlockhash.blockhash,
  lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
  signature: airdropSignature
});

const mintSpace = getMintLen([ExtensionType.PausableConfig]);
const mintRent = await connection.getMinimumBalanceForRentExemption(mintSpace);

await sendAndConfirmTransaction(
  connection,
  new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: feePayer.publicKey, // Account funding account creation.
      newAccountPubkey: mint.publicKey, // New mint account to create.
      space: mintSpace, // Account size in bytes for the mint plus PausableConfig.
      lamports: mintRent, // Lamports funding the mint account rent.
      programId: TOKEN_2022_PROGRAM_ID // Program that owns the mint account.
    }),
    createInitializePausableConfigInstruction(
      mint.publicKey, // Mint account that stores the PausableConfig extension.
      feePayer.publicKey, // Authority allowed to pause and resume the mint.
      TOKEN_2022_PROGRAM_ID // Token program that owns the mint.
    ),
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

const sourceToken = getAssociatedTokenAddressSync(
  mint.publicKey,
  feePayer.publicKey,
  false,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
);
const destinationToken = getAssociatedTokenAddressSync(
  mint.publicKey,
  recipient.publicKey,
  false,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
);

await sendAndConfirmTransaction(
  connection,
  new Transaction().add(
    createAssociatedTokenAccountInstruction(
      feePayer.publicKey, // Account funding the associated token account creation.
      sourceToken, // Associated token account address to create.
      feePayer.publicKey, // Owner of the associated token account.
      mint.publicKey, // Mint for the associated token account.
      TOKEN_2022_PROGRAM_ID, // Token program that owns the token account.
      ASSOCIATED_TOKEN_PROGRAM_ID // Associated Token Program that creates the account.
    ),
    createAssociatedTokenAccountInstruction(
      feePayer.publicKey, // Account funding the associated token account creation.
      destinationToken, // Associated token account address to create.
      recipient.publicKey, // Owner of the associated token account.
      mint.publicKey, // Mint for the associated token account.
      TOKEN_2022_PROGRAM_ID, // Token program that owns the token account.
      ASSOCIATED_TOKEN_PROGRAM_ID // Associated Token Program that creates the account.
    ),
    createMintToCheckedInstruction(
      mint.publicKey, // Mint account that issues the tokens.
      sourceToken, // Token account receiving the newly minted tokens.
      feePayer.publicKey, // Signer authorized to mint new tokens.
      1, // Token amount in base units.
      0, // Decimals defined on the mint.
      [], // Additional multisig signers.
      TOKEN_2022_PROGRAM_ID // Token program that owns the mint and token account.
    )
  ),
  [feePayer],
  { commitment: "confirmed" }
);

await sendAndConfirmTransaction(
  connection,
  new Transaction().add(
    createPauseInstruction(
      mint.publicKey, // Mint account to pause.
      feePayer.publicKey, // Authority allowed to pause the mint.
      [], // Additional multisig signers.
      TOKEN_2022_PROGRAM_ID // Token program that owns the mint.
    )
  ),
  [feePayer],
  { commitment: "confirmed" }
);

const mintAccountAfterPause = await getMint(
  connection,
  mint.publicKey,
  "confirmed",
  TOKEN_2022_PROGRAM_ID
);
const configAfterPause = getPausableConfig(mintAccountAfterPause);

let pausedTransferFailure: string | undefined;
try {
  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(
      createTransferCheckedInstruction(
        sourceToken, // Token account sending the transfer.
        mint.publicKey, // Mint with the pausable configuration.
        destinationToken, // Token account receiving the transfer.
        feePayer.publicKey, // Signer approving the transfer.
        1, // Token amount in base units.
        0, // Decimals defined on the mint.
        [], // Additional multisig signers.
        TOKEN_2022_PROGRAM_ID // Token program that processes the transfer.
      )
    ),
    [feePayer],
    { commitment: "confirmed" }
  );
} catch (error: any) {
  pausedTransferFailure =
    error instanceof Error ? error.message : String(error);
}
if (!pausedTransferFailure) {
  throw new Error("Expected the paused transfer to fail");
}

await sendAndConfirmTransaction(
  connection,
  new Transaction().add(
    createResumeInstruction(
      mint.publicKey, // Mint account to resume.
      feePayer.publicKey, // Authority allowed to resume the mint.
      [], // Additional multisig signers.
      TOKEN_2022_PROGRAM_ID // Token program that owns the mint.
    )
  ),
  [feePayer],
  { commitment: "confirmed" }
);

await sendAndConfirmTransaction(
  connection,
  new Transaction().add(
    createTransferCheckedInstruction(
      sourceToken, // Token account sending the transfer.
      mint.publicKey, // Mint with the pausable configuration.
      destinationToken, // Token account receiving the transfer.
      feePayer.publicKey, // Signer approving the transfer.
      1, // Token amount in base units.
      0, // Decimals defined on the mint.
      [], // Additional multisig signers.
      TOKEN_2022_PROGRAM_ID // Token program that processes the transfer.
    )
  ),
  [feePayer],
  { commitment: "confirmed" }
);

const mintAccountAfterResume = await getMint(
  connection,
  mint.publicKey,
  "confirmed",
  TOKEN_2022_PROGRAM_ID
);
const configAfterResume = getPausableConfig(mintAccountAfterResume);

console.log("\nMint Address:", mint.publicKey.toBase58());
console.log("\nConfig After Pause:", configAfterPause);
console.log("\nError From Failed Transaction:", pausedTransferFailure);
console.log("\nConfig After Resume:", configAfterResume);