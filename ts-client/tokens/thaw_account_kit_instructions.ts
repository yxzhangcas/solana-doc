import {
  fetchToken,
  findAssociatedTokenPda,
  getCreateMintInstructionPlan,
  getFreezeAccountInstruction,
  getMintToATAInstructionPlanAsync,
  getThawAccountInstruction,
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

  const [tokenAccount] = await findAssociatedTokenPda({
    mint: mint.address,
    owner: client.payer.address,
    tokenProgram: TOKEN_PROGRAM_ADDRESS
  });

  // Setup: create a mint, fund the payer's ATA, and freeze the token account before thawing.
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
    getFreezeAccountInstruction({
      account: tokenAccount,
      mint: mint.address,
      owner: client.payer
    })
  ]);

  const result = await client.sendTransaction([
    getThawAccountInstruction({
      account: tokenAccount, // Token account to thaw.
      mint: mint.address, // Mint for the token account being thawed.
      owner: client.payer // Freeze authority approving this change.
    })
  ]);

  const tokenAccountData = await fetchToken(client.rpc, tokenAccount);

  console.log("Mint Address:", mint.address);
  console.log("\nToken Account Address:", tokenAccount);
  console.log("Token Account:", tokenAccountData.data);
  console.log("\nTransaction Signature:", result.context.signature);
}

main();