import {
  lamports,
  createClient,
  generateKeyPairSigner,
  unwrapOption
} from "@solana/kit";
import { solanaRpc, rpcAirdrop } from "@solana/kit-plugin-rpc";
import { generatedPayer, airdropPayer } from "@solana/kit-plugin-signer";
import { getCreateAccountInstruction } from "@solana-program/system";
import {
  AuthorityType,
  extension,
  fetchMint,
  fetchToken,
  findAssociatedTokenPda,
  getBurnCheckedInstruction,
  getCreateAssociatedTokenInstructionAsync,
  getInitializeMintInstruction,
  getInitializePermissionedBurnInstruction,
  getMintSize,
  getMintToCheckedInstruction,
  getPermissionedBurnCheckedInstruction,
  getSetAuthorityInstruction,
  isExtension,
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
const burnAuthority = await generateKeyPairSigner();

const permissionedBurnExtension = extension("PermissionedBurn", {
  authority: burnAuthority.address
});
const mintSpace = BigInt(getMintSize([permissionedBurnExtension]));
const mintRent = await client.rpc
  .getMinimumBalanceForRentExemption(mintSpace)
  .send();

await client.sendTransaction([
  getCreateAccountInstruction({
    payer: client.payer, // Account funding account creation.
    newAccount: mint, // New mint account to create.
    lamports: mintRent, // Lamports funding the mint account rent.
    space: mintSpace, // Account size in bytes for the mint plus PermissionedBurnConfig.
    programAddress: TOKEN_2022_PROGRAM_ADDRESS // Program that owns the mint account.
  }),
  getInitializePermissionedBurnInstruction({
    mint: mint.address, // Mint account that stores the PermissionedBurnConfig extension.
    authority: burnAuthority.address // Authority required to co-sign every burn for the mint.
  }),
  getInitializeMintInstruction({
    mint: mint.address, // Mint account to initialize.
    decimals: 0, // Number of decimals for the token.
    mintAuthority: client.payer.address, // Authority allowed to mint new tokens.
    freezeAuthority: client.payer.address // Authority allowed to freeze token accounts.
  })
]);

const [sourceToken] = await findAssociatedTokenPda({
  mint: mint.address,
  owner: client.payer.address,
  tokenProgram: TOKEN_2022_PROGRAM_ADDRESS
});

await client.sendTransaction([
  await getCreateAssociatedTokenInstructionAsync({
    payer: client.payer, // Account funding the associated token account creation.
    mint: mint.address, // Mint for the associated token account.
    owner: client.payer.address // Owner of the associated token account.
  }),
  getMintToCheckedInstruction({
    mint: mint.address, // Mint account that issues the tokens.
    token: sourceToken, // Token account receiving the newly minted tokens.
    mintAuthority: client.payer, // Signer authorized to mint new tokens.
    amount: 2n, // Token amount in base units.
    decimals: 0 // Decimals defined on the mint.
  })
]);

let standardBurnFailure: string | undefined;
try {
  await client.sendTransaction([
    getBurnCheckedInstruction({
      account: sourceToken, // Token account to burn from.
      mint: mint.address, // Mint with the permissioned burn configuration.
      authority: client.payer, // Token account owner signing the burn.
      amount: 1n, // Token amount in base units.
      decimals: 0 // Decimals defined on the mint.
    })
  ]);
} catch (error) {
  standardBurnFailure = error instanceof Error ? error.message : String(error);
}
if (!standardBurnFailure) {
  throw new Error("Expected the standard burn to fail");
}

await client.sendTransaction([
  getPermissionedBurnCheckedInstruction({
    account: sourceToken, // Token account to burn from.
    mint: mint.address, // Mint with the permissioned burn configuration.
    permissionedBurnAuthority: burnAuthority, // Burn authority co-signing the burn.
    authority: client.payer, // Token account owner signing the burn.
    amount: 1n, // Token amount in base units.
    decimals: 0 // Decimals defined on the mint.
  })
]);

await client.sendTransaction([
  getSetAuthorityInstruction({
    owned: mint.address, // Mint with the permissioned burn configuration.
    owner: burnAuthority, // Current burn authority signing the update.
    authorityType: AuthorityType.PermissionedBurn, // Authority type to update.
    newAuthority: null // Setting the authority to None disables permissioned burning.
  })
]);

await client.sendTransaction([
  getBurnCheckedInstruction({
    account: sourceToken, // Token account to burn from.
    mint: mint.address, // Mint with permissioned burning disabled.
    authority: client.payer, // Token account owner signing the burn.
    amount: 1n, // Token amount in base units.
    decimals: 0 // Decimals defined on the mint.
  })
]);

const sourceAccount = await fetchToken(client.rpc, sourceToken);
const mintAccount = await fetchMint(client.rpc, mint.address);
const permissionedBurnConfig = (
  unwrapOption(mintAccount.data.extensions) ?? []
).find((item) => isExtension("PermissionedBurn", item));

console.log("Mint Address:", mint.address);
console.log("Error From Failed Standard Burn:", standardBurnFailure);
console.log("Source Amount After Burns:", sourceAccount.data.amount);
console.log("Extension After Disable:", permissionedBurnConfig);