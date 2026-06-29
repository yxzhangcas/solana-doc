import {
  fetchToken,
  findAssociatedTokenPda,
  getApproveCheckedInstruction,
  getCreateMintInstructionPlan,
  getMintToATAInstructionPlanAsync,
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
  const delegate = await generateKeyPairSigner();

  const [tokenAccount] = await findAssociatedTokenPda({
    mint: mint.address,
    owner: client.payer.address,
    tokenProgram: TOKEN_PROGRAM_ADDRESS
  });

  // Setup: create a mint and fund the payer's ATA before approving a delegate.
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
    })
  ]);

  const result = await client.sendTransaction([
    getApproveCheckedInstruction({
      source: tokenAccount, // Token account whose delegate approval changes.
      mint: mint.address, // Mint for the token the delegate may spend.
      delegate: delegate.address, // Delegate allowed to spend from the token account.
      owner: client.payer, // Owner approving this delegate change.
      amount: 25n, // Token amount in base units.
      decimals: 2 // Decimals defined on the mint account.
    })
  ]);

  const tokenAccountData = await fetchToken(client.rpc, tokenAccount);

  console.log("Mint Address:", mint.address);
  console.log("\nToken Account Address:", tokenAccount);
  console.log("Token Account:", tokenAccountData.data);
  console.log("\nDelegate Address:", delegate.address);
  console.log("\nTransaction Signature:", result.context.signature);
}

main();