import { lamports, createClient, generateKeyPairSigner } from "@solana/kit";
import { solanaRpc, rpcAirdrop } from "@solana/kit-plugin-rpc";
import { generatedPayer, airdropPayer } from "@solana/kit-plugin-signer";
import { getCreateAccountInstruction } from "@solana-program/system";
import {
  extension,
  fetchMint,
  fetchToken,
  findAssociatedTokenPda,
  getCreateAssociatedTokenInstructionAsync,
  getInitializeMintInstruction,
  getInitializeNonTransferableMintInstruction,
  getMintSize,
  getMintToCheckedInstruction,
  getTransferCheckedInstruction,
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

const nonTransferableExtension = extension("NonTransferable", {});
const mintSpace = BigInt(getMintSize([nonTransferableExtension]));
const mintRent = await client.rpc
  .getMinimumBalanceForRentExemption(mintSpace)
  .send();

await client.sendTransaction([
  getCreateAccountInstruction({
    payer: client.payer,
    newAccount: mint,
    lamports: mintRent,
    space: mintSpace,
    programAddress: TOKEN_2022_PROGRAM_ADDRESS
  }),
  getInitializeNonTransferableMintInstruction({
    mint: mint.address // Mint account that stores the NonTransferable extension.
  }),
  getInitializeMintInstruction({
    mint: mint.address,
    decimals: 0,
    mintAuthority: client.payer.address,
    freezeAuthority: client.payer.address
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
    payer: client.payer,
    mint: mint.address,
    owner: client.payer.address
  }),
  await getCreateAssociatedTokenInstructionAsync({
    payer: client.payer,
    mint: mint.address,
    owner: recipient.address
  }),
  getMintToCheckedInstruction({
    mint: mint.address,
    token: sourceToken,
    mintAuthority: client.payer,
    amount: 1n,
    decimals: 0
  })
]);

try {
  await client.sendTransaction([
    getTransferCheckedInstruction({
      source: sourceToken, // Token account sending the transfer.
      mint: mint.address, // Mint with the non-transferable configuration.
      destination: destinationToken, // Token account receiving the transfer.
      authority: client.payer, // Signer approving the transfer.
      amount: 1n, // Token amount in base units.
      decimals: 0 // Decimals defined on the mint.
    })
  ]);
} catch (error) {
  console.error("Transfer failed as expected:", error); // 期望报错，因为不可转移
}

const mintAccount = await fetchMint(client.rpc, mint.address);
const sourceTokenAccount = await fetchToken(client.rpc, sourceToken);

console.log("Mint Address:", mint.address);
console.log("Mint Extensions:", mintAccount.data.extensions);
console.log("\nSource ATA:", sourceToken);
console.log("Source Token Extensions:", sourceTokenAccount.data.extensions);
console.log("Destination ATA:", destinationToken);