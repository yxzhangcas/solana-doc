import {
  lamports,
  createClient,
  generateKeyPairSigner,
  unwrapOption
} from "@solana/kit";
import { solanaRpc, rpcAirdrop } from "@solana/kit-plugin-rpc";
import { generatedPayer, airdropPayer } from "@solana/kit-plugin-signer";
import { unpack as unpackTokenMetadata } from "@solana/spl-token-metadata";
import { getCreateAccountInstruction } from "@solana-program/system";
import {
  extension,
  fetchMint,
  getEmitTokenMetadataInstruction,
  getInitializeMetadataPointerInstruction,
  getInitializeMintInstruction,
  getInitializeTokenMetadataInstruction,
  getMintSize,
  getRemoveTokenMetadataKeyInstruction,
  getUpdateMetadataPointerInstruction,
  getUpdateTokenMetadataFieldInstruction,
  getUpdateTokenMetadataUpdateAuthorityInstruction,
  isExtension,
  tokenMetadataField,
  TOKEN_2022_PROGRAM_ADDRESS
} from "@solana-program/token-2022";

const client = await createClient()
  .use(generatedPayer())
  .use(
    solanaRpc({
      rpcUrl: "http://localhost:8899",
      rpcSubscriptionsUrl: "ws://localhost:8900"
    })
  )
  .use(rpcAirdrop())
  .use(airdropPayer(lamports(1_000_000_000n)));

const mint = await generateKeyPairSigner();

const metadataPointerExtension = extension("MetadataPointer", {
  authority: client.payer.address,
  metadataAddress: mint.address
});

const mintSpace = BigInt(getMintSize([metadataPointerExtension]));

const maxTokenMetadataExtension = extension("TokenMetadata", {
  updateAuthority: client.payer.address,
  mint: mint.address,
  name: "Example Token v2",
  symbol: "EXMPL",
  uri: "https://example.com/token.json",
  additionalMetadata: new Map([
    ["description", "Metadata stored on mint account"]
  ])
});
const maxMintSpace = BigInt(
  getMintSize([metadataPointerExtension, maxTokenMetadataExtension])
);
const mintRent = await client.rpc
  .getMinimumBalanceForRentExemption(maxMintSpace)
  .send();

await client.sendTransaction([
  getCreateAccountInstruction({
    payer: client.payer, // Account funding account creation.
    newAccount: mint, // New mint account to create.
    lamports: mintRent, // Lamports funding the mint account rent.
    space: mintSpace, // Account size in bytes for the mint plus MetadataPointer.
    programAddress: TOKEN_2022_PROGRAM_ADDRESS // Program that owns the mint account.
  }),
  getInitializeMetadataPointerInstruction({
    mint: mint.address, // Mint account that stores the MetadataPointer extension.
    authority: client.payer.address, // Authority allowed to update the metadata pointer later.
    metadataAddress: mint.address // Account address that stores the metadata.
  }),
  getInitializeMintInstruction({
    mint: mint.address, // Mint account to initialize.
    decimals: 0, // Number of decimals for the token.
    mintAuthority: client.payer.address, // Authority allowed to mint new tokens.
    freezeAuthority: client.payer.address // Authority allowed to freeze token accounts.
  }),
  getInitializeTokenMetadataInstruction({
    metadata: mint.address, // Mint account that stores the metadata.
    updateAuthority: client.payer.address, // Authority allowed to update metadata later.
    mint: mint.address, // Mint that the metadata describes.
    mintAuthority: client.payer, // Signer authorizing metadata initialization for the mint.
    name: "Example Token", // Token name stored in metadata.
    symbol: "EXMPL", // Token symbol stored in metadata.
    uri: "https://example.com/token.json" // URI pointing to off-chain JSON metadata.
  }),
  getUpdateTokenMetadataFieldInstruction({
    metadata: mint.address, // Mint account that stores the metadata.
    updateAuthority: client.payer, // Signer authorized to update metadata fields.
    field: tokenMetadataField("Key", ["description"]), // Custom metadata field to add.
    value: "Metadata stored on mint account" // Value stored for the custom metadata field.
  })
]);

const initialMintAccount = await fetchMint(client.rpc, mint.address);
const initialExtensions =
  unwrapOption(initialMintAccount.data.extensions) ?? [];
const initialTokenMetadata = initialExtensions.find((item) =>
  isExtension("TokenMetadata", item)
);

console.dir(
  {
    mint: mint.address,
    tokenMetadata: initialTokenMetadata
  },
  { depth: null }
);

const updateMetadataTransaction = await client.sendTransaction([
  getUpdateTokenMetadataFieldInstruction({
    metadata: mint.address, // Mint account that stores the metadata.
    updateAuthority: client.payer, // Signer authorized to update metadata fields.
    field: tokenMetadataField("Name"), // Base metadata field to update.
    value: "Example Token v2" // Updated value for the token name.
  }),
  getUpdateMetadataPointerInstruction({
    mint: mint.address, // Mint account that stores the MetadataPointer extension.
    metadataPointerAuthority: client.payer, // Signer authorized to update the metadata pointer.
    metadataAddress: mint.address // Account address that stores the metadata.
  }),
  getRemoveTokenMetadataKeyInstruction({
    metadata: mint.address, // Mint account that stores the metadata.
    updateAuthority: client.payer, // Signer authorized to remove custom metadata.
    key: "description" // Custom metadata key to remove.
  }),
  getUpdateTokenMetadataUpdateAuthorityInstruction({
    metadata: mint.address, // Mint account that stores the metadata.
    updateAuthority: client.payer, // Current signer authorized to change the update authority.
    newUpdateAuthority: null // Clear the update authority so metadata can no longer be changed.
  }),
  getEmitTokenMetadataInstruction({
    metadata: mint.address // Mint account that stores the metadata to emit.
  })
]);

const updateMetadataResult = await client.rpc
  .getTransaction(updateMetadataTransaction.context.signature, {
    encoding: "json",
    maxSupportedTransactionVersion: 0
  })
  .send();
const emittedDataBase64 = updateMetadataResult?.meta?.returnData?.data?.[0];
if (!emittedDataBase64) {
  throw new Error("Expected token metadata return data");
}
const emittedTokenMetadata = unpackTokenMetadata(
  Buffer.from(emittedDataBase64, "base64")
);

const mintAccount = await fetchMint(client.rpc, mint.address);
const extensions = unwrapOption(mintAccount.data.extensions) ?? [];
const metadataPointer = extensions.find((item) =>
  isExtension("MetadataPointer", item)
);
const tokenMetadata = extensions.find((item) =>
  isExtension("TokenMetadata", item)
);

console.dir(
  {
    mint: mint.address,
    metadataPointer,
    tokenMetadata,
    emittedTokenMetadata
  },
  { depth: null }
);