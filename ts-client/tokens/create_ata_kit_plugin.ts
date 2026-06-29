import {
  associatedTokenProgram,
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
    .use(tokenProgram())
    .use(associatedTokenProgram());

  // Setup: Create a mint for this example.
  const mint = await generateKeyPairSigner();

  await client.token.instructions
    .createMint({
      newMint: mint,
      decimals: 2,
      mintAuthority: client.payer.address,
      freezeAuthority: client.payer.address
    })
    .sendTransaction();

  const result = await client.associatedToken.instructions
    .createAssociatedToken({
      payer: client.payer, // Account funding account creation.
      mint: mint.address, // Mint for the token this account holds.
      owner: client.payer.address // Account that owns the token account.
    })
    .sendTransaction();

  const [associatedTokenAddress] = await findAssociatedTokenPda({
    mint: mint.address,
    owner: client.payer.address,
    tokenProgram: TOKEN_PROGRAM_ADDRESS
  });

  const tokenAccountData = await client.token.accounts.token.fetch(
    associatedTokenAddress
  );

  console.log("Mint Address:", mint.address);
  console.log("\nAssociated Token Account Address:", associatedTokenAddress);
  console.log("Associated Token Account:", tokenAccountData.data);
  console.log("\nTransaction Signature:", result.context.signature);
}

main();