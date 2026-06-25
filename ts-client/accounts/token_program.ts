import { Address, createClient } from "@solana/kit";
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

  const programId = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" as Address;

  const accountInfo = await client.rpc
    .getAccountInfo(programId, { encoding: "base64" })
    .send();
  console.log(accountInfo);
}

main();