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
  AccountState,
  extension,
  fetchMint,
  fetchToken,
  findAssociatedTokenPda,
  getCreateAssociatedTokenInstructionAsync,
  getInitializeDefaultAccountStateInstruction,
  getInitializeMintInstruction,
  getMintSize,
  getUpdateDefaultAccountStateInstruction,
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

const getAccountStateLabel = (state: AccountState) => {
  switch (state) {
    case AccountState.Frozen:
      return "Frozen";
    case AccountState.Initialized:
      return "Initialized";
    default:
      return "Uninitialized";
  }
};

const defaultAccountStateExtension = extension("DefaultAccountState", {
  state: AccountState.Frozen
});
const mintSpace = BigInt(getMintSize([defaultAccountStateExtension]));
const mintRent = await client.rpc
  .getMinimumBalanceForRentExemption(mintSpace)
  .send();

await client.sendTransaction([
  getCreateAccountInstruction({
    payer: client.payer, // Account funding the new mint account.
    newAccount: mint, // New mint account to create.
    lamports: mintRent, // Lamports funding the mint account rent.
    space: mintSpace, // Account size in bytes for the mint plus DefaultAccountState.
    programAddress: TOKEN_2022_PROGRAM_ADDRESS // Program that owns the mint account.
  }),
  getInitializeDefaultAccountStateInstruction({
    mint: mint.address, // Mint account that stores the DefaultAccountState extension.
    state: AccountState.Frozen // Default state assigned to new token accounts.
  }),
  getInitializeMintInstruction({
    mint: mint.address, // Mint account to initialize.
    decimals: 0, // Number of decimals for the token.
    mintAuthority: client.payer.address, // Authority allowed to mint new tokens.
    freezeAuthority: client.payer.address // Authority allowed to freeze token accounts.
  })
]);

const [tokenAccount] = await findAssociatedTokenPda({
  mint: mint.address,
  owner: client.payer.address,
  tokenProgram: TOKEN_2022_PROGRAM_ADDRESS
});

await client.sendTransaction([
  await getCreateAssociatedTokenInstructionAsync({
    payer: client.payer, // Account funding the associated token account creation.
    mint: mint.address, // Mint for the associated token account.
    owner: client.payer.address // Owner of the token account.
  })
]);

const tokenAccountBeforeUpdate = await fetchToken(client.rpc, tokenAccount);
const mintAccountBeforeUpdate = await fetchMint(client.rpc, mint.address);
const defaultAccountStateBeforeUpdate = (
  unwrapOption(mintAccountBeforeUpdate.data.extensions) ?? []
).find((item) => isExtension("DefaultAccountState", item));

await client.sendTransaction([
  getUpdateDefaultAccountStateInstruction({
    mint: mint.address, // Mint account that stores the DefaultAccountState extension.
    freezeAuthority: client.payer, // Freeze authority authorized to update the default state.
    state: AccountState.Initialized // New default state assigned to later token accounts.
  })
]);

const tokenAccountAfterUpdate = await fetchToken(client.rpc, tokenAccount);
const mintAccountAfterUpdate = await fetchMint(client.rpc, mint.address);
const defaultAccountStateAfterUpdate = (
  unwrapOption(mintAccountAfterUpdate.data.extensions) ?? []
).find((item) => isExtension("DefaultAccountState", item));

console.log("Mint Address:", mint.address);
console.log(
  "Default Account State Before Update:",
  defaultAccountStateBeforeUpdate
);
console.log(
  "Token Account State Before Update:",
  getAccountStateLabel(tokenAccountBeforeUpdate.data.state)
);
console.log(
  "Default Account State After Update:",
  defaultAccountStateAfterUpdate
);
console.log(
  "Token Account State After Update:",
  getAccountStateLabel(tokenAccountAfterUpdate.data.state)
);