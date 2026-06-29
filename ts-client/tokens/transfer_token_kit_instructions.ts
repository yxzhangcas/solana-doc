import {
  fetchAllToken,
  findAssociatedTokenPda,
  getCreateAssociatedTokenInstructionAsync,
  getCreateMintInstructionPlan,
  getMintToATAInstructionPlanAsync,
  getTransferCheckedInstruction,
  TOKEN_PROGRAM_ADDRESS
} from "@solana-program/token";
import { createClient, generateKeyPairSigner, lamports } from "@solana/kit";
import { rpcAirdrop, solanaRpc } from "@solana/kit-plugin-rpc";
import { airdropPayer, generatedPayer } from "@solana/kit-plugin-signer";

async function main() {
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

  const [sourceTokenAccount] = await findAssociatedTokenPda({
    mint: mint.address,
    owner: client.payer.address,
    tokenProgram: TOKEN_PROGRAM_ADDRESS
  });

  const [destinationTokenAccount] = await findAssociatedTokenPda({
    mint: mint.address,
    owner: recipient.address,
    tokenProgram: TOKEN_PROGRAM_ADDRESS
  });

  // Setup: create a mint, fund the payer's ATA, and create the recipient's ATA.
  await client.sendTransaction([
    getCreateMintInstructionPlan({
      payer: client.payer,
      newMint: mint,
      decimals: 2,
      mintAuthority: client.payer.address,
      freezeAuthority: client.payer.address
    }),
    await getMintToATAInstructionPlanAsync({
      payer: client.payer,
      mint: mint.address,
      owner: client.payer.address,
      mintAuthority: client.payer,
      amount: 100n,
      decimals: 2
    }),
    await getCreateAssociatedTokenInstructionAsync({
      payer: client.payer,
      mint: mint.address,
      owner: recipient.address
    })
  ]);

  const result = await client.sendTransaction([
    getTransferCheckedInstruction({
      source: sourceTokenAccount, // Token account sending the tokens.
      mint: mint.address, // Mint for the token being transferred.
      destination: destinationTokenAccount, // Token account receiving the tokens.
      authority: client.payer, // Owner or delegate approving the transfer.
      amount: 25n, // Token amount in base units.
      decimals: 2 // Decimals defined on the mint account.
    })
  ]);

  const [sourceTokenAccountData, destinationTokenAccountData] =
    await fetchAllToken(client.rpc, [
      sourceTokenAccount,
      destinationTokenAccount
    ]);

  console.log("Mint Address:", mint.address);
  console.log("\nSource Token Account Address:", sourceTokenAccount);
  console.log("Source Token Account:", sourceTokenAccountData.data);
  console.log("\nDestination Token Account Address:", destinationTokenAccount);
  console.log("Destination Token Account:", destinationTokenAccountData.data);
  console.log("\nTransaction Signature:", result.context.signature);
}

main();