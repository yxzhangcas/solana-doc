import { getCreateAccountInstruction } from "@solana-program/system";
import {
  fetchToken,
  getInitializeAccountInstruction,
  getInitializeMintInstruction,
  getMintSize,
  getTokenSize,
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

  // Setup: Create a mint for this example.
  const mint = await generateKeyPairSigner();

  const space = BigInt(getMintSize());
  const rent = await client.rpc.getMinimumBalanceForRentExemption(space).send();

  await client.sendTransaction([
    getCreateAccountInstruction({
      payer: client.payer,
      newAccount: mint,
      lamports: rent,
      space,
      programAddress: TOKEN_PROGRAM_ADDRESS
    }),
    getInitializeMintInstruction({
      mint: mint.address,
      decimals: 2,
      mintAuthority: client.payer.address,
      freezeAuthority: client.payer.address
    })
  ]);

  const tokenAccount = await generateKeyPairSigner();

  const tokenAccountSpace = BigInt(getTokenSize());
  const tokenAccountRent = await client.rpc
    .getMinimumBalanceForRentExemption(tokenAccountSpace)
    .send();

  const result = await client.sendTransaction([
    getCreateAccountInstruction({
      payer: client.payer, // Account funding account creation.
      newAccount: tokenAccount, // New token account to create.
      lamports: tokenAccountRent, // Lamports funding the new account rent.
      space: tokenAccountSpace, // Account size in bytes.
      programAddress: TOKEN_PROGRAM_ADDRESS // Program that owns the new account.
    }),
    getInitializeAccountInstruction({
      account: tokenAccount.address, // Token account to initialize.
      mint: mint.address, // Mint for the token this account holds.
      owner: client.payer.address // Account that owns the token account.
    })
  ]);

  const tokenAccountData = await fetchToken(client.rpc, tokenAccount.address);

  console.log("Mint Address:", mint.address);
  console.log("\nToken Account Address:", tokenAccount.address);
  console.log("Token Account:", tokenAccountData.data);
  console.log("\nTransaction Signature:", result.context.signature);
}

main();