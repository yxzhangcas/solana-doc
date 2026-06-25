import { address, createClient, fetchJsonParsedAccount } from "@solana/kit";
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

  const tokenProgramAddress = address(
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
  );

  const accountInfo = await client.rpc
    .getAccountInfo(tokenProgramAddress, {
      encoding: "base64"
    })
    .send();

  console.log(accountInfo);

  const parsedAccount = await fetchJsonParsedAccount(
    client.rpc,
    tokenProgramAddress
  );

  console.log(parsedAccount);
}

main();