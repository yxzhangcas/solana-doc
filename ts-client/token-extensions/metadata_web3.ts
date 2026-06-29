import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction
} from "@solana/web3.js";
import {
  createInitializeMetadataPointerInstruction,
  createInitializeMintInstruction,
  createUpdateMetadataPointerInstruction,
  ExtensionType,
  getMetadataPointerState,
  getMint,
  getMintLen,
  getTokenMetadata,
  LENGTH_SIZE,
  TOKEN_2022_PROGRAM_ID,
  TYPE_SIZE
} from "@solana/spl-token";
import {
  createInitializeInstruction,
  createEmitInstruction,
  createRemoveKeyInstruction,
  unpack as unpackTokenMetadata,
  createUpdateAuthorityInstruction,
  createUpdateFieldInstruction,
  pack,
  type TokenMetadata
} from "@solana/spl-token-metadata";

const connection = new Connection("http://localhost:8899", "confirmed");
const latestBlockhash = await connection.getLatestBlockhash();

const feePayer = Keypair.generate();
const mint = Keypair.generate();

const airdropSignature = await connection.requestAirdrop(
  feePayer.publicKey,
  LAMPORTS_PER_SOL
);
await connection.confirmTransaction({
  blockhash: latestBlockhash.blockhash,
  lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
  signature: airdropSignature
});

const maxMetadata: TokenMetadata = {
  updateAuthority: feePayer.publicKey,
  mint: mint.publicKey,
  name: "Example Token v2",
  symbol: "EXMPL",
  uri: "https://example.com/token.json",
  additionalMetadata: [["description", "Metadata stored on mint account"]]
};

const mintSpace = getMintLen([ExtensionType.MetadataPointer]);
const metadataSpace = TYPE_SIZE + LENGTH_SIZE + pack(maxMetadata).length;
const mintRent = await connection.getMinimumBalanceForRentExemption(
  mintSpace + metadataSpace
);

await sendAndConfirmTransaction(
  connection,
  new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: feePayer.publicKey, // Account funding account creation.
      newAccountPubkey: mint.publicKey, // New mint account to create.
      lamports: mintRent, // Lamports funding the mint account rent.
      space: mintSpace, // Account size in bytes for the mint plus MetadataPointer.
      programId: TOKEN_2022_PROGRAM_ID // Program that owns the mint account.
    }),
    createInitializeMetadataPointerInstruction(
      mint.publicKey, // Mint account that stores the MetadataPointer extension.
      feePayer.publicKey, // Authority allowed to update the metadata pointer later.
      mint.publicKey, // Account address that stores the metadata.
      TOKEN_2022_PROGRAM_ID // Program that owns the mint account.
    ),
    createInitializeMintInstruction(
      mint.publicKey, // Mint account to initialize.
      0, // Number of decimals for the token.
      feePayer.publicKey, // Authority allowed to mint new tokens.
      feePayer.publicKey, // Authority allowed to freeze token accounts.
      TOKEN_2022_PROGRAM_ID // Program that owns the mint account.
    ),
    createInitializeInstruction({
      programId: TOKEN_2022_PROGRAM_ID, // Program that owns the mint and metadata.
      metadata: mint.publicKey, // Mint account that stores the metadata.
      updateAuthority: feePayer.publicKey, // Authority allowed to update metadata later.
      mint: mint.publicKey, // Mint that the metadata describes.
      mintAuthority: feePayer.publicKey, // Signer authorizing metadata initialization for the mint.
      name: "Example Token", // Token name stored in metadata.
      symbol: "EXMPL", // Token symbol stored in metadata.
      uri: "https://example.com/token.json" // URI pointing to off-chain JSON metadata.
    }),
    createUpdateFieldInstruction({
      programId: TOKEN_2022_PROGRAM_ID, // Program that owns the metadata.
      metadata: mint.publicKey, // Mint account that stores the metadata.
      updateAuthority: feePayer.publicKey, // Authority allowed to update metadata fields.
      field: "description", // Custom metadata field to add.
      value: "Metadata stored on mint account" // Value stored for the custom metadata field.
    })
  ),
  [feePayer, mint],
  { commitment: "confirmed" }
);

const initialTokenMetadata = await getTokenMetadata(
  connection,
  mint.publicKey,
  "confirmed",
  TOKEN_2022_PROGRAM_ID
);

console.log(
  JSON.stringify(
    {
      mint: mint.publicKey,
      tokenMetadata: initialTokenMetadata
    },
    null,
    2
  )
);

const updateMetadataSignature = await sendAndConfirmTransaction(
  connection,
  new Transaction().add(
    createUpdateFieldInstruction({
      programId: TOKEN_2022_PROGRAM_ID, // Program that owns the metadata.
      metadata: mint.publicKey, // Mint account that stores the metadata.
      updateAuthority: feePayer.publicKey, // Authority allowed to update metadata fields.
      field: "name", // Base metadata field to update.
      value: "Example Token v2" // Updated value for the token name.
    }),
    createUpdateMetadataPointerInstruction(
      mint.publicKey, // Mint account that stores the MetadataPointer extension.
      feePayer.publicKey, // Authority allowed to update the metadata pointer.
      mint.publicKey, // Account address that stores the metadata.
      [], // Additional signer accounts required by the instruction.
      TOKEN_2022_PROGRAM_ID // Program that owns the mint account.
    ),
    createRemoveKeyInstruction({
      programId: TOKEN_2022_PROGRAM_ID, // Program that owns the metadata.
      metadata: mint.publicKey, // Mint account that stores the metadata.
      updateAuthority: feePayer.publicKey, // Authority allowed to remove custom metadata.
      key: "description", // Custom metadata key to remove.
      idempotent: false // Fail if the custom metadata key does not exist.
    }),
    createUpdateAuthorityInstruction({
      programId: TOKEN_2022_PROGRAM_ID, // Program that owns the metadata.
      metadata: mint.publicKey, // Mint account that stores the metadata.
      oldAuthority: feePayer.publicKey, // Current authority allowed to change the update authority.
      newAuthority: null // Clear the update authority so metadata can no longer be changed.
    }),
    createEmitInstruction({
      programId: TOKEN_2022_PROGRAM_ID, // Program that owns the metadata.
      metadata: mint.publicKey // Mint account that stores the metadata to emit.
    })
  ),
  [feePayer],
  { commitment: "confirmed" }
);

const updateMetadataTransaction = (await connection.getTransaction(
  updateMetadataSignature,
  {
    maxSupportedTransactionVersion: 0
  }
)) as any;
const emittedDataBase64 =
  updateMetadataTransaction?.meta?.returnData?.data?.[0];
if (!emittedDataBase64) {
  throw new Error("Expected token metadata return data");
}
const emittedTokenMetadata = unpackTokenMetadata(
  Buffer.from(emittedDataBase64, "base64")
);

const mintAccount = await getMint(
  connection,
  mint.publicKey,
  "confirmed",
  TOKEN_2022_PROGRAM_ID
);
const metadataPointer = getMetadataPointerState(mintAccount);
const tokenMetadata = await getTokenMetadata(
  connection,
  mint.publicKey,
  "confirmed",
  TOKEN_2022_PROGRAM_ID
);

console.log(
  JSON.stringify(
    {
      mint: mint.publicKey,
      metadataPointer,
      tokenMetadata,
      emittedTokenMetadata
    },
    null,
    2
  )
);