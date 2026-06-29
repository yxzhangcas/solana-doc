import { systemProgram } from "@solana-program/system";
import {
  getTokenSize,
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
    .use(systemProgram())
    .use(tokenProgram());

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

  const tokenAccount = await generateKeyPairSigner();

  const space = BigInt(getTokenSize());
  const rent = await client.rpc.getMinimumBalanceForRentExemption(space).send();

  const result = await client.sendTransaction([
    client.system.instructions.createAccount({
      newAccount: tokenAccount, // New token account to create.
      lamports: rent, // Lamports funding the new account rent.
      space, // Account size in bytes.
      programAddress: TOKEN_PROGRAM_ADDRESS // Program that owns the new account.
    }),
    client.token.instructions.initializeAccount({
      account: tokenAccount.address, // Token account to initialize.
      mint: mint.address, // Mint for the token this account holds.
      owner: client.payer.address // Account that owns the token account.
    })
  ]);

  const tokenAccountData = await client.token.accounts.token.fetch(
    tokenAccount.address
  );

  console.log("Mint Address:", mint.address);
  console.log("\nToken Account Address:", tokenAccount.address);
  console.log("Token Account:", tokenAccountData.data);
  console.log("\nTransaction Signature:", result.context.signature);
}

main();