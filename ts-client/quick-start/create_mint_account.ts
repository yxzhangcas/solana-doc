import { createClient, generateKeyPairSigner, lamports } from "@solana/kit";
import { solanaRpc, rpcAirdrop } from "@solana/kit-plugin-rpc";
import { generatedPayer, airdropPayer } from "@solana/kit-plugin-signer";
import { getCreateAccountInstruction } from "@solana-program/system";
import {
  fetchMint,
  getInitializeMintInstruction,
  getMintSize,
  TOKEN_2022_PROGRAM_ADDRESS
} from "@solana-program/token-2022";

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

  const space = BigInt(getMintSize());

  const rent = await client.rpc.getMinimumBalanceForRentExemption(space).send();

  const createAccountInstruction = getCreateAccountInstruction({
    payer: client.payer,
    newAccount: mint,
    space,
    lamports: rent,
    programAddress: TOKEN_2022_PROGRAM_ADDRESS
  });

  const initializeMintInstruction = getInitializeMintInstruction({
    mint: mint.address,
    decimals: 2,
    mintAuthority: client.payer.address,
    freezeAuthority: client.payer.address,
    // tokenProgram: TOKEN_2022_PROGRAM_ADDRESS
  });

  const result = await client.sendTransaction([
    createAccountInstruction,
    initializeMintInstruction
  ]);

  console.log("Mint Address:", mint.address);
  console.log("Transaction Signature:", result.context.signature);

  const mintAccount = await fetchMint(client.rpc, mint.address);
  console.log("Mint Account:", mintAccount);
}

main();