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
  amountToUiAmountForMintWithoutSimulation,
  extension,
  fetchMint,
  findAssociatedTokenPda,
  getCreateAssociatedTokenInstructionAsync,
  getInitializeMintInstruction,
  getInitializeScaledUiAmountMintInstruction,
  getMintSize,
  getMintToCheckedInstruction,
  getUpdateMultiplierScaledUiMintInstruction,
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
const recipient = await generateKeyPairSigner();
const initialMultiplier = 5.0;
const updatedMultiplier = 10.0;
const tokenAmount = 1_000n;

const scaledUiAmountExtension = extension("ScaledUiAmountConfig", {
  authority: client.payer.address,
  multiplier: initialMultiplier,
  newMultiplierEffectiveTimestamp: 0n,
  newMultiplier: initialMultiplier
});
const mintSpace = BigInt(getMintSize([scaledUiAmountExtension]));
const mintRent = await client.rpc
  .getMinimumBalanceForRentExemption(mintSpace)
  .send();

await client.sendTransaction([
  getCreateAccountInstruction({
    payer: client.payer, // Account funding the new mint account.
    newAccount: mint, // New mint account to create.
    lamports: mintRent, // Lamports funding the mint account rent.
    space: mintSpace, // Account size in bytes for the mint plus ScaledUiAmountConfig.
    programAddress: TOKEN_2022_PROGRAM_ADDRESS // Program that owns the mint account.
  }),
  getInitializeScaledUiAmountMintInstruction({
    mint: mint.address, // Mint account that stores the ScaledUiAmountConfig extension.
    authority: client.payer.address, // Authority allowed to update the multiplier later.
    multiplier: initialMultiplier // Initial multiplier used for displayed UI amounts.
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
  owner: recipient.address,
  tokenProgram: TOKEN_2022_PROGRAM_ADDRESS
});

await client.sendTransaction([
  await getCreateAssociatedTokenInstructionAsync({
    payer: client.payer, // Account funding the associated token account creation.
    mint: mint.address, // Mint for the associated token account.
    owner: recipient.address // Owner of the token account.
  }),
  getMintToCheckedInstruction({
    mint: mint.address, // Mint account that issues the tokens.
    token: tokenAccount, // Token account receiving the newly minted tokens.
    mintAuthority: client.payer, // Signer authorized to mint new tokens.
    amount: tokenAmount, // Token amount in base units.
    decimals: 0 // Decimals defined on the mint.
  })
]);

const calculatedUiAmountBeforeUpdate =
  await amountToUiAmountForMintWithoutSimulation(
    client.rpc,
    mint.address,
    tokenAmount
  );

const updateMultiplierInstruction = getUpdateMultiplierScaledUiMintInstruction({
  mint: mint.address, // Mint account that stores the ScaledUiAmountConfig extension.
  authority: client.payer, // Signer authorized to update the multiplier.
  multiplier: updatedMultiplier, // New multiplier used for displayed UI amounts.
  effectiveTimestamp: 0n // Unix timestamp when the new multiplier takes effect.
});

await client.sendTransaction([updateMultiplierInstruction]);

const calculatedUiAmountAfterUpdate =
  await amountToUiAmountForMintWithoutSimulation(
    client.rpc,
    mint.address,
    tokenAmount
  );

const mintAccount = await fetchMint(client.rpc, mint.address);
const scaledUiAmountConfig = (
  unwrapOption(mintAccount.data.extensions) ?? []
).find((item) => isExtension("ScaledUiAmountConfig", item));

console.log("Mint Address:", mint.address);
console.log("Token Account:", tokenAccount);
console.log(
  "Calculated UI Amount Before Update:",
  calculatedUiAmountBeforeUpdate
);
console.log(
  "Calculated UI Amount After Update:",
  calculatedUiAmountAfterUpdate
);
console.log("ScaledUiAmountConfig:", scaledUiAmountConfig);