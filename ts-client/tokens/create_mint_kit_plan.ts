import { fetchMint, getCreateMintInstructionPlan } from "@solana-program/token";
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

  const result = await client.sendTransaction(
    getCreateMintInstructionPlan({
      payer: client.payer, // Account funding account creation.
      newMint: mint, // New mint account to create.
      decimals: 9, // Decimals to define on the mint account.
      mintAuthority: client.payer.address, // Authority allowed to mint new tokens.
      freezeAuthority: client.payer.address // Authority allowed to freeze token accounts.
    })
  );

  const mintAccount = await fetchMint(client.rpc, mint.address);

  console.log("Mint Address:", mint.address);
  console.log("Mint Account:", mintAccount.data);
  console.log("\nTransaction Signature:", result.context.signature);
}

main();