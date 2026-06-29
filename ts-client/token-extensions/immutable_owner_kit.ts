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
  fetchToken,
  getInitializeAccountInstruction,
  getInitializeImmutableOwnerInstruction,
  getInitializeMintInstruction,
  getMintSize,
  getSetAuthorityInstruction,
  getTokenSize,
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
const tokenAccount = await generateKeyPairSigner();
const newOwner = await generateKeyPairSigner();

const mintSpace = BigInt(getMintSize());
const mintRent = await client.rpc
  .getMinimumBalanceForRentExemption(mintSpace)
  .send();

await client.sendTransaction([
  getCreateAccountInstruction({
    payer: client.payer, // Account funding the new mint account.
    newAccount: mint, // New mint account to create.
    lamports: mintRent, // Lamports funding the mint account rent.
    space: mintSpace, // Account size in bytes for the mint.
    programAddress: TOKEN_2022_PROGRAM_ADDRESS // Program that owns the mint account.
  }),
  getInitializeMintInstruction({
    mint: mint.address, // Mint account to initialize.
    decimals: 0, // Number of decimals for the token.
    mintAuthority: client.payer.address, // Authority allowed to mint new tokens.
    freezeAuthority: client.payer.address // Authority allowed to freeze token accounts.
  })
]);

const immutableOwnerExtension = extension("ImmutableOwner", {});
const tokenSpace = BigInt(getTokenSize([immutableOwnerExtension]));
const tokenRent = await client.rpc
  .getMinimumBalanceForRentExemption(tokenSpace)
  .send();

await client.sendTransaction([
  getCreateAccountInstruction({
    payer: client.payer, // Account funding the new token account.
    newAccount: tokenAccount, // New token account to create.
    lamports: tokenRent, // Lamports funding the token account rent.
    space: tokenSpace, // Account size in bytes for the token account plus ImmutableOwner.
    programAddress: TOKEN_2022_PROGRAM_ADDRESS // Program that owns the token account.
  }),
  getInitializeImmutableOwnerInstruction({
    account: tokenAccount.address // Token account that stores the ImmutableOwner extension.
  }),
  getInitializeAccountInstruction({
    account: tokenAccount.address, // Token account to initialize.
    mint: mint.address, // Mint for the token account.
    owner: client.payer.address // Owner of the token account.
  })
]);

let failure: string | undefined;
try {
  await client.sendTransaction([
    getSetAuthorityInstruction({
      owned: tokenAccount.address, // Token account whose authority is being updated.
      owner: client.payer, // Current token account owner signing the instruction.
      authorityType: AuthorityType.AccountOwner, // Account authority field to change.
      newAuthority: newOwner.address // New token account owner to set.
    })
  ]);
} catch (error) {
  failure = String(error);
}
if (!failure) {
  throw new Error("Expected the owner change to fail");
}

const token = await fetchToken(client.rpc, tokenAccount.address);
const immutableOwnerExtensionState = (
  unwrapOption(token.data.extensions) ?? []
).find((item) => isExtension("ImmutableOwner", item));

console.log("Mint Address:", mint.address);
console.log("Token Account:", tokenAccount.address);
console.log("ImmutableOwner Extension:", immutableOwnerExtensionState);
console.log("SetAuthority Failure:", failure);