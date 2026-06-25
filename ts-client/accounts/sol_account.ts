import { airdropFactory, createClient, generateKeyPairSigner, lamports } from "@solana/kit";
import { solanaRpc } from "@solana/kit-plugin-rpc";
import { generatedPayer } from "@solana/kit-plugin-signer";

async function main() {
  const client = await createClient()
    .use(generatedPayer())
    .use(
      solanaRpc({
        rpcUrl: "http://localhost:8899",
        rpcSubscriptionsUrl: "ws://localhost:8900"
      })
    );

  // Generate a new keypair
  const keypair = await generateKeyPairSigner();
  console.log(`Public Key: ${keypair.address}`);

  // Funding an address with SOL automatically creates an account
  const airdrop = airdropFactory({ rpc: client.rpc, rpcSubscriptions: client.rpcSubscriptions });
  const signature = await airdrop({
    commitment: 'confirmed',
    recipientAddress: keypair.address,
    lamports: lamports(1_000_000_000n)
  });

  const accountInfo = await client.rpc.getAccountInfo(keypair.address).send();
  console.log(accountInfo);
}

main();