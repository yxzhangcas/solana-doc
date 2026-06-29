import {
  lamports,
  createClient,
  generateKeyPairSigner,
  unwrapOption
} from "@solana/kit";
import { solanaRpc, rpcAirdrop } from "@solana/kit-plugin-rpc";
import { generatedPayer, airdropPayer } from "@solana/kit-plugin-signer";
import { getAddMemoInstruction } from "@solana-program/memo";
import { getCreateAccountInstruction } from "@solana-program/system";
import {
  extension,
  fetchToken,
  findAssociatedTokenPda,
  getCreateAssociatedTokenInstructionAsync,
  getDisableMemoTransfersInstruction,
  getEnableMemoTransfersInstruction,
  getInitializeAccountInstruction,
  getInitializeMintInstruction,
  getMintSize,
  getMintToCheckedInstruction,
  getTokenSize,
  getTransferCheckedInstruction,
  isExtension,
  TOKEN_2022_PROGRAM_ADDRESS
} from "@solana-program/token-2022";

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

const mint = await generateKeyPairSigner();
const tokenOwner = await generateKeyPairSigner();
const tokenAccount = await generateKeyPairSigner();
const tokenAmount = 1n;

const mintSpace = BigInt(getMintSize());
const mintRent = await client.rpc
  .getMinimumBalanceForRentExemption(mintSpace)
  .send();

await client.sendTransaction([
  getCreateAccountInstruction({
    payer: client.payer, // Account funding the new mint account.
    newAccount: mint, // New mint account to create.
    lamports: mintRent, // Lamports funding the mint account rent.
    space: mintSpace, // Account size in bytes for the mint.
    programAddress: TOKEN_2022_PROGRAM_ADDRESS // Program that owns the mint account.
  }),
  getInitializeMintInstruction({
    mint: mint.address, // Mint account to initialize.
    decimals: 0, // Number of decimals for the token.
    mintAuthority: client.payer.address, // Authority allowed to mint new tokens.
    freezeAuthority: client.payer.address // Authority allowed to freeze token accounts.
  })
]);

const [sourceToken] = await findAssociatedTokenPda({
  mint: mint.address, // Mint for the source token account.
  owner: client.payer.address, // Owner of the source token account.
  tokenProgram: TOKEN_2022_PROGRAM_ADDRESS // Token program that owns the token account.
});

const memoTransferAccountExtension = extension("MemoTransfer", {
  requireIncomingTransferMemos: false
});
const tokenSpace = BigInt(getTokenSize([memoTransferAccountExtension]));
const tokenRent = await client.rpc
  .getMinimumBalanceForRentExemption(tokenSpace)
  .send();

await client.sendTransaction([
  await getCreateAssociatedTokenInstructionAsync({
    payer: client.payer, // Account funding the associated token account creation.
    mint: mint.address, // Mint for the associated token account.
    owner: client.payer.address // Owner of the associated token account.
  }),
  getMintToCheckedInstruction({
    mint: mint.address, // Mint account that issues the tokens.
    token: sourceToken, // Token account receiving the newly minted tokens.
    mintAuthority: client.payer, // Signer authorized to mint new tokens.
    amount: tokenAmount, // Token amount in base units.
    decimals: 0 // Decimals defined on the mint.
  }),
  getCreateAccountInstruction({
    payer: client.payer, // Account funding the new token account.
    newAccount: tokenAccount, // New token account to create.
    lamports: tokenRent, // Lamports funding the token account rent.
    space: tokenSpace, // Account size in bytes for the token account plus MemoTransfer.
    programAddress: TOKEN_2022_PROGRAM_ADDRESS // Program that owns the token account.
  }),
  getInitializeAccountInstruction({
    account: tokenAccount.address, // Token account to initialize.
    mint: mint.address, // Mint for the token account.
    owner: tokenOwner.address // Owner of the token account.
  })
]);

await client.sendTransaction([
  getEnableMemoTransfersInstruction({
    token: tokenAccount.address, // Token account that stores the MemoTransfer extension.
    owner: tokenOwner // Token account owner authorized to toggle memo requirements.
  })
]);

await client.sendTransaction([
  getAddMemoInstruction({
    memo: "memo required" // Memo string required by the destination token account.
  }),
  getTransferCheckedInstruction({
    source: sourceToken, // Token account sending the transfer.
    mint: mint.address, // Mint for the transfer.
    destination: tokenAccount.address, // Token account receiving the transfer.
    authority: client.payer, // Owner of the source token account.
    amount: tokenAmount, // Token amount in base units.
    decimals: 0 // Decimals defined on the mint.
  })
]);

await client.sendTransaction([
  getDisableMemoTransfersInstruction({
    token: tokenAccount.address, // Token account that stores the MemoTransfer extension.
    owner: tokenOwner // Token account owner authorized to toggle memo requirements.
  })
]);

const tokenAccountData = await fetchToken(client.rpc, tokenAccount.address);
const memoTransferExtension = (
  unwrapOption(tokenAccountData.data.extensions) ?? []
).find((item) => isExtension("MemoTransfer", item));

console.log("Mint Address:", mint.address);
console.log("Token Account:", tokenAccount.address);
console.log("Destination Amount:", tokenAccountData.data.amount);
console.log("MemoTransfer Extension:", memoTransferExtension);