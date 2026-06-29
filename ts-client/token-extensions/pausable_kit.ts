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
  fetchMint,
  findAssociatedTokenPda,
  getCreateAssociatedTokenInstructionAsync,
  getInitializeMintInstruction,
  getInitializePausableConfigInstruction,
  getMintSize,
  getMintToCheckedInstruction,
  getPauseInstruction,
  getResumeInstruction,
  getTransferCheckedInstruction,
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

const pausableExtension = extension("PausableConfig", {
  authority: client.payer.address,
  paused: false
});
const mintSpace = BigInt(getMintSize([pausableExtension]));
const mintRent = await client.rpc
  .getMinimumBalanceForRentExemption(mintSpace)
  .send();

await client.sendTransaction([
  getCreateAccountInstruction({
    payer: client.payer, // Account funding account creation.
    newAccount: mint, // New mint account to create.
    lamports: mintRent, // Lamports funding the mint account rent.
    space: mintSpace, // Account size in bytes for the mint plus PausableConfig.
    programAddress: TOKEN_2022_PROGRAM_ADDRESS // Program that owns the mint account.
  }),
  getInitializePausableConfigInstruction({
    mint: mint.address, // Mint account that stores the PausableConfig extension.
    authority: client.payer.address // Authority allowed to pause and resume the mint.
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
const [destinationToken] = await findAssociatedTokenPda({
  mint: mint.address,
  owner: recipient.address,
  tokenProgram: TOKEN_2022_PROGRAM_ADDRESS
});

await client.sendTransaction([
  await getCreateAssociatedTokenInstructionAsync({
    payer: client.payer, // Account funding the associated token account creation.
    mint: mint.address, // Mint for the associated token account.
    owner: client.payer.address // Owner of the associated token account.
  }),
  await getCreateAssociatedTokenInstructionAsync({
    payer: client.payer, // Account funding the associated token account creation.
    mint: mint.address, // Mint for the associated token account.
    owner: recipient.address // Owner of the associated token account.
  }),
  getMintToCheckedInstruction({
    mint: mint.address, // Mint account that issues the tokens.
    token: sourceToken, // Token account receiving the newly minted tokens.
    mintAuthority: client.payer, // Signer authorized to mint new tokens.
    amount: 1n, // Token amount in base units.
    decimals: 0 // Decimals defined on the mint.
  })
]);

await client.sendTransaction([
  getPauseInstruction({
    mint: mint.address, // Mint account to pause.
    authority: client.payer // Signer authorized to pause the mint.
  })
]);

const mintAccountAfterPause = await fetchMint(client.rpc, mint.address);
const configAfterPause = (
  unwrapOption(mintAccountAfterPause.data.extensions) ?? []
).find((item) => isExtension("PausableConfig", item));

let pausedTransferFailure: string | undefined;
try {
  await client.sendTransaction([
    getTransferCheckedInstruction({
      source: sourceToken, // Token account sending the transfer.
      mint: mint.address, // Mint with the pausable configuration.
      destination: destinationToken, // Token account receiving the transfer.
      authority: client.payer, // Signer approving the transfer.
      amount: 1n, // Token amount in base units.
      decimals: 0 // Decimals defined on the mint.
    })
  ]);
} catch (error) {
  pausedTransferFailure =
    error instanceof Error ? error.message : String(error);
}
if (!pausedTransferFailure) {
  throw new Error("Expected the paused transfer to fail");
}

await client.sendTransaction([
  getResumeInstruction({
    mint: mint.address, // Mint account to resume.
    authority: client.payer // Signer authorized to resume the mint.
  })
]);

await client.sendTransaction([
  getTransferCheckedInstruction({
    source: sourceToken, // Token account sending the transfer.
    mint: mint.address, // Mint with the pausable configuration.
    destination: destinationToken, // Token account receiving the transfer.
    authority: client.payer, // Signer approving the transfer.
    amount: 1n, // Token amount in base units.
    decimals: 0 // Decimals defined on the mint.
  })
]);

const mintAccountAfterResume = await fetchMint(client.rpc, mint.address);
const configAfterResume = (
  unwrapOption(mintAccountAfterResume.data.extensions) ?? []
).find((item) => isExtension("PausableConfig", item));

console.log("\nMint Address:", mint.address);
console.log("\nConfig After Pause:", configAfterPause);
console.log("\nError From Failed Transaction:", pausedTransferFailure);
console.log("\nConfig After Resume:", configAfterResume);