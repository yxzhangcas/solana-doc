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
  const delegate = await generateKeyPairSigner();

  const [tokenAccount] = await findAssociatedTokenPda({
    mint: mint.address,
    owner: client.payer.address,
    tokenProgram: TOKEN_PROGRAM_ADDRESS
  });

  // Setup: create a mint, fund the payer's ATA, and approve a delegate first.
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
    }),
    client.token.instructions.approveChecked({
      source: tokenAccount,
      mint: mint.address,
      delegate: delegate.address,
      owner: client.payer,
      amount: 25n,
      decimals: 2
    })
  ]);

  const result = await client.token.instructions
    .revoke({
      source: tokenAccount, // Token account whose delegate approval changes.
      owner: client.payer // Owner approving this delegate change.
    })
    .sendTransaction();

  const tokenAccountData = await client.token.accounts.token.fetch(tokenAccount);

  console.log("Mint Address:", mint.address);
  console.log("\nToken Account Address:", tokenAccount);
  console.log("Token Account:", tokenAccountData.data);
  console.log("\nDelegate Address:", delegate.address);
  console.log("\nTransaction Signature:", result.context.signature);
}

main();