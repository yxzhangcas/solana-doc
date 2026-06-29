import { getCreateAccountInstruction } from "@solana-program/system";
import {
  fetchMint,
  getInitializeMintInstruction,
  getMintSize,
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

  // Generate keypair to use as address of mint
  const mint = await generateKeyPairSigner();

  // Get default mint account size (in bytes)
  const space = BigInt(getMintSize());

  // Get minimum balance for rent exemption
  const rent = await client.rpc.getMinimumBalanceForRentExemption(space).send();

  // Create and initialize the mint account in one transaction
  const result = await client.sendTransaction([
    getCreateAccountInstruction({
      payer: client.payer, // Account funding account creation.
      newAccount: mint, // New mint account to create.
      lamports: rent, // Lamports funding the new account rent.
      space, // Account size in bytes.
      programAddress: TOKEN_PROGRAM_ADDRESS // Program that owns the new account.
    }),
    getInitializeMintInstruction({
      mint: mint.address, // Mint account to initialize.
      decimals: 9, // Decimals to define on the mint account.
      mintAuthority: client.payer.address, // Authority allowed to mint new tokens.
      freezeAuthority: client.payer.address // Authority allowed to freeze token accounts.
    })
  ]);

  const mintAccount = await fetchMint(client.rpc, mint.address);

  console.log("Mint Address:", mint.address);
  console.log("Mint Account:", mintAccount.data);
  console.log("\nTransaction Signature:", result.context.signature);
}

main();