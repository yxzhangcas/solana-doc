import { systemProgram } from "@solana-program/system";
import {
  fetchMint,
  getInitializeMintInstruction,
  getMintSize,
  TOKEN_2022_PROGRAM_ADDRESS
} from "@solana-program/token-2022";
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
    .use(airdropPayer(lamports(1_000_000_000n)))
    .use(systemProgram());

  // Generate keypair to use as address of mint
  const mint = await generateKeyPairSigner();

  // Get default mint account size (in bytes), no extensions enabled
  const space = BigInt(getMintSize());

  // Get minimum balance for rent exemption
  const rent = await client.rpc.getMinimumBalanceForRentExemption(space).send();

  const transactionSignature = await client.sendTransaction([
    client.system.instructions.createAccount({
      newAccount: mint,
      lamports: rent,
      space,
      programAddress: TOKEN_2022_PROGRAM_ADDRESS
    }),
    getInitializeMintInstruction({
      mint: mint.address,
      decimals: 9,
      mintAuthority: client.payer.address
    })
  ]);

  console.log("Mint Address:", mint.address);
  console.log("Transaction Signature:", transactionSignature.context.signature);

  const accountInfo = await client.rpc.getAccountInfo(mint.address).send();
  console.log(accountInfo);

  const mintAccount = await fetchMint(client.rpc, mint.address);
  console.log(mintAccount);
}

main();