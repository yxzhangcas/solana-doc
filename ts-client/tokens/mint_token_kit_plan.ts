import {
  fetchMint,
  fetchToken,
  findAssociatedTokenPda,
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

  // Setup: create a mint before minting tokens to the payer's ATA.
  await client.sendTransaction(
    getCreateMintInstructionPlan({
      payer: client.payer,
      newMint: mint,
      decimals: 2,
      mintAuthority: client.payer.address,
      freezeAuthority: client.payer.address
    })
  );

  const result = await client.sendTransaction(
    await getMintToATAInstructionPlanAsync({
      payer: client.payer, // Account funding account creation.
      mint: mint.address, // Mint for the token being minted.
      owner: client.payer.address, // Account that owns the token account receiving the minted tokens.
      mintAuthority: client.payer, // Authority allowed to mint new tokens.
      amount: 100n, // Token amount in base units.
      decimals: 2 // Decimals defined on the mint account.
    })
  );

  const [tokenAccount] = await findAssociatedTokenPda({
    mint: mint.address,
    owner: client.payer.address,
    tokenProgram: TOKEN_PROGRAM_ADDRESS
  });

  const mintAccount = await fetchMint(client.rpc, mint.address);
  const tokenAccountData = await fetchToken(client.rpc, tokenAccount);

  console.log("Mint Address:", mint.address);
  console.log("Mint Account:", mintAccount.data);
  console.log("\nToken Account Address:", tokenAccount);
  console.log("Token Account:", tokenAccountData.data);
  console.log("\nTransaction Signature:", result.context.signature);
}

main();