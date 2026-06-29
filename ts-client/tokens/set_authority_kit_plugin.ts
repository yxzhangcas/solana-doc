import { AuthorityType, tokenProgram } from "@solana-program/token";
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
  const newAuthority = await generateKeyPairSigner();

  // Setup: create a mint before changing its authorities.
  await client.token.instructions
    .createMint({
      newMint: mint,
      decimals: 2,
      mintAuthority: client.payer.address,
      freezeAuthority: client.payer.address
    })
    .sendTransaction();

  const result = await client.sendTransaction([
    client.token.instructions.setAuthority({
      owned: mint.address, // Mint whose authority changes.
      owner: client.payer, // Current authority approving this change.
      authorityType: AuthorityType.MintTokens, // Authority role to update on the mint.
      newAuthority: newAuthority.address // New authority to assign to this role.
    }),
    client.token.instructions.setAuthority({
      owned: mint.address, // Mint whose authority changes.
      owner: client.payer, // Current authority approving this change.
      authorityType: AuthorityType.FreezeAccount, // Authority role to update on the mint.
      newAuthority: newAuthority.address // New authority to assign to this role.
    })
  ]);

  const mintAccount = await client.token.accounts.mint.fetch(mint.address);

  console.log("Mint Address:", mint.address);
  console.log("Mint Account:", mintAccount.data);
  console.log("\nNew Authority Address:", newAuthority.address);
  console.log("\nTransaction Signature:", result.context.signature);
}

main();