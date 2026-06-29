import {
  lamports,
  createClient,
  generateKeyPairSigner,
  unwrapOption
} from "@solana/kit";
import { solanaRpc, rpcAirdrop } from "@solana/kit-plugin-rpc";
import { generatedPayer, airdropPayer } from "@solana/kit-plugin-signer";
import { getCreateAccountInstruction } from "@solana-program/system";
import {
  extension,
  fetchMint,
  fetchToken,
  findAssociatedTokenPda,
  getCreateAssociatedTokenInstructionAsync,
  getInitializeMintInstruction,
  getInitializePermanentDelegateInstruction,
  getMintSize,
  getMintToCheckedInstruction,
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
const owner = await generateKeyPairSigner();
const delegate = await generateKeyPairSigner();
const recipient = await generateKeyPairSigner();

const permanentDelegateExtension = extension("PermanentDelegate", {
  delegate: delegate.address
});
const mintSpace = BigInt(getMintSize([permanentDelegateExtension]));
const mintRent = await client.rpc
  .getMinimumBalanceForRentExemption(mintSpace)
  .send();

await client.sendTransaction([
  getCreateAccountInstruction({
    payer: client.payer, // Account funding the new mint account.
    newAccount: mint, // New mint account to create.
    lamports: mintRent, // Lamports funding the mint account rent.
    space: mintSpace, // Account size in bytes for the mint plus PermanentDelegate.
    programAddress: TOKEN_2022_PROGRAM_ADDRESS // Program that owns the mint account.
  }),
  getInitializePermanentDelegateInstruction({
    mint: mint.address, // Mint account that stores the PermanentDelegate extension.
    delegate: delegate.address // Permanent delegate authorized for all token accounts for the mint.
  }),
  getInitializeMintInstruction({
    mint: mint.address, // Mint account to initialize.
    decimals: 0, // Number of decimals for the token.
    mintAuthority: client.payer.address, // Authority allowed to mint new tokens.
    freezeAuthority: client.payer.address // Authority allowed to freeze token accounts.
  })
]);

const [sourceToken] = await findAssociatedTokenPda({
  mint: mint.address,
  owner: owner.address,
  tokenProgram: TOKEN_2022_PROGRAM_ADDRESS
});
const [destinationToken] = await findAssociatedTokenPda({
  mint: mint.address,
  owner: recipient.address,
  tokenProgram: TOKEN_2022_PROGRAM_ADDRESS
});

await client.sendTransaction([
  await getCreateAssociatedTokenInstructionAsync({
    payer: client.payer, // Account funding the associated token account creation.
    mint: mint.address, // Mint for the associated token account.
    owner: owner.address // Owner of the source token account.
  }),
  await getCreateAssociatedTokenInstructionAsync({
    payer: client.payer, // Account funding the associated token account creation.
    mint: mint.address, // Mint for the associated token account.
    owner: recipient.address // Owner of the destination token account.
  }),
  getMintToCheckedInstruction({
    mint: mint.address, // Mint account that issues the tokens.
    token: sourceToken, // Token account receiving the newly minted tokens.
    mintAuthority: client.payer, // Signer authorized to mint new tokens.
    amount: 1n, // Token amount in base units.
    decimals: 0 // Decimals defined on the mint.
  })
]);

await client.sendTransaction([
  getTransferCheckedInstruction({
    source: sourceToken, // Token account sending the transfer.
    mint: mint.address, // Mint with the permanent delegate configuration.
    destination: destinationToken, // Token account receiving the transfer.
    authority: delegate, // Permanent delegate signing the transfer.
    amount: 1n, // Token amount in base units.
    decimals: 0 // Decimals defined on the mint.
  })
]);

const destinationAccount = await fetchToken(client.rpc, destinationToken);
const mintAccount = await fetchMint(client.rpc, mint.address);
const permanentDelegate = (
  unwrapOption(mintAccount.data.extensions) ?? []
).find((item) => isExtension("PermanentDelegate", item));

console.log("Mint Address:", mint.address);
console.log("Destination Amount:", destinationAccount.data.amount);
console.log("Permanent Delegate Extension:", permanentDelegate);