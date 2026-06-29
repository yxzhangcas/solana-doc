import {
  findAssociatedTokenPda,
  getCreateAssociatedTokenInstructionAsync,
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
  const destination = client.payer.address;

  const [tokenAccount] = await findAssociatedTokenPda({
    mint: mint.address,
    owner: client.payer.address,
    tokenProgram: TOKEN_PROGRAM_ADDRESS
  });

  // Setup: create a mint and the payer's ATA before closing the token account.
  await client.sendTransaction([
    client.token.instructions.createMint({
      newMint: mint,
      decimals: 2,
      mintAuthority: client.payer.address,
      freezeAuthority: client.payer.address
    }),
    await getCreateAssociatedTokenInstructionAsync({
      payer: client.payer,
      mint: mint.address,
      owner: client.payer.address
    })
  ]);

  const result = await client.token.instructions
    .closeAccount({
      account: tokenAccount, // Token account to close.
      destination, // Account receiving the reclaimed SOL.
      owner: client.payer // Owner approving the account closure.
    })
    .sendTransaction();

  const tokenAccountData =
    await client.token.accounts.token.fetchMaybe(tokenAccount);

  console.log("Mint Address:", mint.address);
  console.log("\nToken Account Address:", tokenAccount);
  console.log("Token Account:", tokenAccountData);
  console.log("\nDestination Address:", destination);
  console.log("\nTransaction Signature:", result.context.signature);
}

main();