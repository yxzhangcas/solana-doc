import { address, createClient } from "@solana/kit";
import { solanaRpc } from "@solana/kit-plugin-rpc";
import { generatedPayer } from "@solana/kit-plugin-signer";

async function main() {
  const client = await createClient()
    .use(generatedPayer())
    .use(
      solanaRpc({
        rpcUrl: "http://localhost:8899"
      })
    );

  const mintAddress = address("So11111111111111111111111111111111111111112");

  const accountInfo = await client.rpc
    .getAccountInfo(mintAddress, {
      encoding: "base64"
    })
    .send();

  console.log(accountInfo);
}

main();