import {
  AuthorityType,
  createMint,
  createSetAuthorityInstruction,
  getMint,
  TOKEN_PROGRAM_ID
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  Transaction
} from "@solana/web3.js";

async function main() {
  // Setup: create a mint before changing its authorities.
  const connection = new Connection("http://localhost:8899", "confirmed");
  const latestBlockhash = await connection.getLatestBlockhash();

  const feePayer = Keypair.generate();
  const newAuthority = Keypair.generate();

  const airdropSignature = await connection.requestAirdrop(
    feePayer.publicKey,
    LAMPORTS_PER_SOL
  );
  await connection.confirmTransaction({
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    signature: airdropSignature
  });

  const mintPubkey = await createMint(
    connection,
    feePayer,
    feePayer.publicKey,
    feePayer.publicKey,
    2,
    Keypair.generate(),
    {
      commitment: "confirmed"
    },
    TOKEN_PROGRAM_ID
  );

  const authorityBlockhash = await connection.getLatestBlockhash();
  const result = await sendAndConfirmTransaction(
    connection,
    new Transaction({
      feePayer: feePayer.publicKey,
      blockhash: authorityBlockhash.blockhash,
      lastValidBlockHeight: authorityBlockhash.lastValidBlockHeight
    }).add(
      createSetAuthorityInstruction(
        mintPubkey, // Mint whose authority changes.
        feePayer.publicKey, // Current authority approving this change.
        AuthorityType.MintTokens, // Authority role to update on the mint.
        newAuthority.publicKey, // New authority to assign to this role.
        [], // Additional multisig signers.
        TOKEN_PROGRAM_ID // Token program to invoke.
      ),
      createSetAuthorityInstruction(
        mintPubkey, // Mint whose authority changes.
        feePayer.publicKey, // Current authority approving this change.
        AuthorityType.FreezeAccount, // Authority role to update on the mint.
        newAuthority.publicKey, // New authority to assign to this role.
        [], // Additional multisig signers.
        TOKEN_PROGRAM_ID // Token program to invoke.
      )
    ),
    [feePayer]
  );

  const mintAccount = await getMint(
    connection,
    mintPubkey,
    "confirmed",
    TOKEN_PROGRAM_ID
  );

  console.log("Mint Address:", mintPubkey.toBase58());
  console.log("Mint Account:", mintAccount);
  console.log("\nNew Authority Address:", newAuthority.publicKey.toBase58());
  console.log("\nTransaction Signature:", result);
}

main();