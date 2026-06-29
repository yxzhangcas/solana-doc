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
  createInitializeNonTransferableMintInstruction,
  createMintToCheckedInstruction,
  createTransferCheckedInstruction,
  ExtensionType,
  getAccount,
  getAssociatedTokenAddressSync,
  getMint,
  getMintLen,
  getNonTransferable,
  TOKEN_2022_PROGRAM_ID
} from "@solana/spl-token";

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
const mintSpace = getMintLen([ExtensionType.NonTransferable]);
const mintRent = await connection.getMinimumBalanceForRentExemption(mintSpace);

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
  new Transaction({
    feePayer: feePayer.publicKey,
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
  }).add(
    SystemProgram.createAccount({
      fromPubkey: feePayer.publicKey,
      newAccountPubkey: mint.publicKey,
      lamports: mintRent,
      space: mintSpace,
      programId: TOKEN_2022_PROGRAM_ID
    }),
    createInitializeNonTransferableMintInstruction(
      mint.publicKey, // Mint account that stores the NonTransferable extension.
      TOKEN_2022_PROGRAM_ID // Token program that owns the mint.
    ),
    createInitializeMintInstruction(
      mint.publicKey,
      0,
      feePayer.publicKey,
      feePayer.publicKey,
      TOKEN_2022_PROGRAM_ID
    )
  ),
  [feePayer, mint],
  { commitment: "confirmed" }
);

await sendAndConfirmTransaction(
  connection,
  new Transaction().add(
    createAssociatedTokenAccountInstruction(
      feePayer.publicKey,
      sourceToken,
      feePayer.publicKey,
      mint.publicKey,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    ),
    createAssociatedTokenAccountInstruction(
      feePayer.publicKey,
      destinationToken,
      recipient.publicKey,
      mint.publicKey,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    ),
    createMintToCheckedInstruction(
      mint.publicKey,
      sourceToken,
      feePayer.publicKey,
      1,
      0,
      [],
      TOKEN_2022_PROGRAM_ID
    )
  ),
  [feePayer],
  { commitment: "confirmed" }
);

try {
  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(
      createTransferCheckedInstruction(
        sourceToken, // Token account sending the transfer.
        mint.publicKey, // Mint with the non-transferable configuration.
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
} catch (error) {
  console.error("Transfer failed as expected:", error);
}

const mintAccount = await getMint(
  connection,
  mint.publicKey,
  "confirmed",
  TOKEN_2022_PROGRAM_ID
);
const sourceTokenAccount = await getAccount(
  connection,
  sourceToken,
  "confirmed",
  TOKEN_2022_PROGRAM_ID
);

console.log("Mint Address:", mint.publicKey.toBase58());
console.log("Has NonTransferable:", getNonTransferable(mintAccount) !== null);
console.log("\nSource ATA:", sourceToken.toBase58());
console.log("Source Token Account:", sourceTokenAccount);
console.log("Destination ATA:", destinationToken.toBase58());