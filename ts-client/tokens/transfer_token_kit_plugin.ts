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
  const recipient = await generateKeyPairSigner();

  // Setup: create a mint and fund the payer's ATA before transferring tokens.
  await client.sendTransaction([
    client.token.instructions.createMint({
      newMint: mint,
      decimals: 2,
      mintAuthority: client.payer.address,
      freezeAuthority: client.payer.address
    }),
    await client.token.instructions.mintToATA({
      mint: mint.address,
      owner: client.payer.address,
      mintAuthority: client.payer,
      amount: 100n,
      decimals: 2
    })
  ]);

  const result = await client.token.instructions
    .transferToATA({
      mint: mint.address, // Mint for the token being transferred.
      authority: client.payer, // Owner or delegate approving the transfer.
      recipient: recipient.address, // Account that owns the destination token account.
      amount: 25n, // Token amount in base units.
      decimals: 2 // Decimals defined on the mint account.
    })
    .sendTransaction();

  const [sourceTokenAccount] = await findAssociatedTokenPda({
    mint: mint.address,
    owner: client.payer.address,
    tokenProgram: TOKEN_PROGRAM_ADDRESS
  });

  const [destinationTokenAccount] = await findAssociatedTokenPda({
    mint: mint.address,
    owner: recipient.address,
    tokenProgram: TOKEN_PROGRAM_ADDRESS
  });

  const [sourceTokenAccountData, destinationTokenAccountData] =
    await client.token.accounts.token.fetchAll([
      sourceTokenAccount,
      destinationTokenAccount
    ]);

  console.log("Mint Address:", mint.address);
  console.log("\nSource Token Account Address:", sourceTokenAccount);
  console.log("Source Token Account:", sourceTokenAccountData.data);
  console.log("\nDestination Token Account Address:", destinationTokenAccount);
  console.log("Destination Token Account:", destinationTokenAccountData.data);
  console.log("\nTransaction Signature:", result.context.signature);
}

main();