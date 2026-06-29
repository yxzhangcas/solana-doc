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
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  createInitializePermanentDelegateInstruction,
  createMintToCheckedInstruction,
  createTransferCheckedInstruction,
  ExtensionType,
  getAccount,
  getAssociatedTokenAddressSync,
  getMint,
  getMintLen,
  getPermanentDelegate,
  TOKEN_2022_PROGRAM_ID
} from "@solana/spl-token";

const connection = new Connection("http://localhost:8899", "confirmed");
const latestBlockhash = await connection.getLatestBlockhash();

const feePayer = Keypair.generate();
const owner = Keypair.generate();
const delegate = Keypair.generate();
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

const extensions = [ExtensionType.PermanentDelegate];

const mint = Keypair.generate();
const mintLength = getMintLen(extensions);
const mintRent = await connection.getMinimumBalanceForRentExemption(mintLength);

const sourceToken = getAssociatedTokenAddressSync(
  mint.publicKey,
  owner.publicKey,
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

const createMintAccountInstruction = SystemProgram.createAccount({
  fromPubkey: feePayer.publicKey, // Account funding the new mint account.
  newAccountPubkey: mint.publicKey, // New mint account to create.
  space: mintLength, // Account size in bytes for the mint plus PermanentDelegate.
  lamports: mintRent, // Lamports funding the mint account rent.
  programId: TOKEN_2022_PROGRAM_ID // Program that owns the mint account.
});

const initializePermanentDelegateInstruction =
  createInitializePermanentDelegateInstruction(
    mint.publicKey, // Mint account that stores the PermanentDelegate extension.
    delegate.publicKey, // Permanent delegate authorized for all token accounts for the mint.
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
    initializePermanentDelegateInstruction,
    initializeMintInstruction
  ),
  [feePayer, mint],
  {
    commitment: "confirmed"
  }
);

await sendAndConfirmTransaction(
  connection,
  new Transaction().add(
    createAssociatedTokenAccountInstruction(
      feePayer.publicKey, // Account funding the associated token account creation.
      sourceToken, // Associated token account address to create.
      owner.publicKey, // Owner of the source token account.
      mint.publicKey, // Mint for the associated token account.
      TOKEN_2022_PROGRAM_ID, // Token program that owns the token account.
      ASSOCIATED_TOKEN_PROGRAM_ID // Associated Token Program that creates the account.
    ),
    createAssociatedTokenAccountInstruction(
      feePayer.publicKey, // Account funding the associated token account creation.
      destinationToken, // Associated token account address to create.
      recipient.publicKey, // Owner of the destination token account.
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
  {
    commitment: "confirmed"
  }
);

await sendAndConfirmTransaction(
  connection,
  new Transaction().add(
    createTransferCheckedInstruction(
      sourceToken, // Token account sending the transfer.
      mint.publicKey, // Mint with the permanent delegate configuration.
      destinationToken, // Token account receiving the transfer.
      delegate.publicKey, // Permanent delegate signing the transfer.
      1, // Token amount in base units.
      0, // Decimals defined on the mint.
      [], // Additional multisig signers.
      TOKEN_2022_PROGRAM_ID // Token program that processes the transfer.
    )
  ),
  [feePayer, delegate],
  {
    commitment: "confirmed"
  }
);

const destinationAccount = await getAccount(
  connection,
  destinationToken,
  "confirmed",
  TOKEN_2022_PROGRAM_ID
);
const mintAccount = await getMint(
  connection,
  mint.publicKey,
  "confirmed",
  TOKEN_2022_PROGRAM_ID
);
const permanentDelegate = getPermanentDelegate(mintAccount);

console.log("Mint Address:", mint.publicKey.toBase58());
console.log("Destination Amount:", destinationAccount.amount.toString());
console.log("Permanent Delegate Extension:", permanentDelegate);