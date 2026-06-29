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
  extension,
  fetchToken,
  getDisableCpiGuardInstruction,
  getEnableCpiGuardInstruction,
  getInitializeAccountInstruction,
  getInitializeMintInstruction,
  getMintSize,
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

const mintSpace = BigInt(getMintSize());
const mintRent = await client.rpc
  .getMinimumBalanceForRentExemption(mintSpace)
  .send();

await client.sendTransaction([
  getCreateAccountInstruction({
    payer: client.payer, // Account funding account creation.
    newAccount: mint, // New mint account to create.
    lamports: mintRent, // Lamports funding the mint account rent.
    space: mintSpace, // Account size in bytes for the mint account.
    programAddress: TOKEN_2022_PROGRAM_ADDRESS // Program that owns the mint account.
  }),
  getInitializeMintInstruction({
    mint: mint.address, // Mint account to initialize.
    decimals: 0, // Number of decimals for the token.
    mintAuthority: client.payer.address, // Authority allowed to mint new tokens.
    freezeAuthority: client.payer.address // Authority allowed to freeze token accounts.
  })
]);

const cpiGuardExtension = extension("CpiGuard", {
  lockCpi: false
});
const tokenSpace = BigInt(getTokenSize([cpiGuardExtension]));
const tokenRent = await client.rpc
  .getMinimumBalanceForRentExemption(tokenSpace)
  .send();

await client.sendTransaction([
  getCreateAccountInstruction({
    payer: client.payer, // Account funding account creation.
    newAccount: tokenAccount, // New token account to create.
    lamports: tokenRent, // Lamports funding the token account rent.
    space: tokenSpace, // Account size in bytes for the token account plus CpiGuard.
    programAddress: TOKEN_2022_PROGRAM_ADDRESS // Program that owns the token account.
  }),
  getInitializeAccountInstruction({
    account: tokenAccount.address, // Token account to initialize.
    mint: mint.address, // Mint for the token account.
    owner: client.payer.address // Owner allowed to control the token account.
  })
]);

await client.sendTransaction([
  getEnableCpiGuardInstruction({
    token: tokenAccount.address, // Token account that stores the CpiGuard extension.
    owner: client.payer // Token account owner authorized to enable CPI guard.
  })
]);

const enabledTokenAccount = await fetchToken(client.rpc, tokenAccount.address);
const enabledCpiGuard = (
  unwrapOption(enabledTokenAccount.data.extensions) ?? []
).find((item) => isExtension("CpiGuard", item));

await client.sendTransaction([
  getDisableCpiGuardInstruction({
    token: tokenAccount.address, // Token account that stores the CpiGuard extension.
    owner: client.payer // Token account owner authorized to disable CPI guard.
  })
]);

const disabledTokenAccount = await fetchToken(client.rpc, tokenAccount.address);
const disabledCpiGuard = (
  unwrapOption(disabledTokenAccount.data.extensions) ?? []
).find((item) => isExtension("CpiGuard", item));

console.log("\nMint Address:", mint.address);
console.log("\nToken Account:", tokenAccount.address);
console.log("\nEnabled CPI Guard:", enabledCpiGuard);
console.log("\nDisabled CPI Guard:", disabledCpiGuard);