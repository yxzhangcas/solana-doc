import { lamports, createClient, generateKeyPairSigner } from "@solana/kit";
import { solanaRpc, rpcAirdrop } from "@solana/kit-plugin-rpc";
import { generatedPayer, airdropPayer } from "@solana/kit-plugin-signer";
import { getCreateAccountInstruction } from "@solana-program/system";
import {
  extension,
  findAssociatedTokenPda,
  getBurnCheckedInstruction,
  getCloseAccountInstruction,
  getCreateAssociatedTokenInstructionAsync,
  getInitializeMintCloseAuthorityInstruction,
  getInitializeMintInstruction,
  getMintSize,
  getMintToCheckedInstruction,
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
const destination = await generateKeyPairSigner();

const mintCloseAuthorityExtension = extension("MintCloseAuthority", {
  closeAuthority: client.payer.address
});
const mintSpace = BigInt(getMintSize([mintCloseAuthorityExtension]));
const mintRent = await client.rpc
  .getMinimumBalanceForRentExemption(mintSpace)
  .send();

await client.sendTransaction([
  getCreateAccountInstruction({
    payer: client.payer,
    newAccount: mint,
    lamports: mintRent,
    space: mintSpace,
    programAddress: TOKEN_2022_PROGRAM_ADDRESS
  }),
  getInitializeMintCloseAuthorityInstruction({
    mint: mint.address, // Mint account that stores the MintCloseAuthority extension.
    closeAuthority: client.payer.address // Authority allowed to close the mint.
  }),
  getInitializeMintInstruction({
    mint: mint.address,
    decimals: 0,
    mintAuthority: client.payer.address,
    freezeAuthority: client.payer.address
  })
]);

const [token] = await findAssociatedTokenPda({
  mint: mint.address,
  owner: client.payer.address,
  tokenProgram: TOKEN_2022_PROGRAM_ADDRESS
});

await client.sendTransaction([
  await getCreateAssociatedTokenInstructionAsync({
    payer: client.payer,
    mint: mint.address,
    owner: client.payer.address
  }),
  getMintToCheckedInstruction({
    mint: mint.address,
    token,
    mintAuthority: client.payer,
    amount: 1n,
    decimals: 0
  })
]);

await client.sendTransaction([
  getBurnCheckedInstruction({
    mint: mint.address,
    account: token,
    authority: client.payer,
    amount: 1n,
    decimals: 0
  }),
  getCloseAccountInstruction({
    account: mint.address, // Mint account to close.
    destination: destination.address, // Account receiving the reclaimed lamports.
    owner: client.payer // Close authority signing the instruction.
  })
]);

const mintInfo = await client.rpc.getAccountInfo(mint.address).send();

console.log("Mint Address:", mint.address);
console.log("Destination Address:", destination.address);
console.log("Mint Closed:", mintInfo.value === null);