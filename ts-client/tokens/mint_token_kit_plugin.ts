import {
  findAssociatedTokenPda,
  TOKEN_PROGRAM_ADDRESS,
  tokenProgram
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
    .use(airdropPayer(lamports(1_000_000_000n)))
    .use(tokenProgram());

  const mint = await generateKeyPairSigner();

  // Setup: create a mint before minting tokens to the payer's ATA.
  await client.token.instructions
    .createMint({
      newMint: mint,
      decimals: 2,
      mintAuthority: client.payer.address,
      freezeAuthority: client.payer.address
    })
    .sendTransaction();

  const result = await client.token.instructions
    .mintToATA({
      mint: mint.address, // Mint for the token being minted.
      owner: client.payer.address, // Account that owns the token account receiving the minted tokens.
      mintAuthority: client.payer, // Authority allowed to mint new tokens.
      amount: 100n, // Token amount in base units.
      decimals: 2 // Decimals defined on the mint account.
    })
    .sendTransaction();

  const [tokenAccount] = await findAssociatedTokenPda({
    mint: mint.address,
    owner: client.payer.address,
    tokenProgram: TOKEN_PROGRAM_ADDRESS
  });

  const mintAccount = await client.token.accounts.mint.fetch(mint.address);
  const tokenAccountData = await client.token.accounts.token.fetch(tokenAccount);

  console.log("Mint Address:", mint.address);
  console.log("Mint Account:", mintAccount.data);
  console.log("\nToken Account Address:", tokenAccount);
  console.log("Token Account:", tokenAccountData.data);
  console.log("\nTransaction Signature:", result.context.signature);
}

main();