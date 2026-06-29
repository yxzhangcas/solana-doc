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
  getHarvestWithheldTokensToMintInstruction,
  getInitializeMintInstruction,
  getInitializeTransferFeeConfigInstruction,
  getMintSize,
  getMintToCheckedInstruction,
  getSetTransferFeeInstruction,
  getTransferCheckedWithFeeInstruction,
  getWithdrawWithheldTokensFromAccountsInstruction,
  getWithdrawWithheldTokensFromMintInstruction,
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
const recipientA = await generateKeyPairSigner();
const recipientB = await generateKeyPairSigner();
const feeReceiver = await generateKeyPairSigner();

const transferFeeConfigExtension = extension("TransferFeeConfig", {
  transferFeeConfigAuthority: client.payer.address,
  withdrawWithheldAuthority: client.payer.address,
  withheldAmount: 0n,
  olderTransferFee: {
    epoch: 0n,
    maximumFee: 10n,
    transferFeeBasisPoints: 150
  },
  newerTransferFee: {
    epoch: 0n,
    maximumFee: 10n,
    transferFeeBasisPoints: 150
  }
});
const mintSpace = BigInt(getMintSize([transferFeeConfigExtension]));
const mintRent = await client.rpc
  .getMinimumBalanceForRentExemption(mintSpace)
  .send();

await client.sendTransaction([
  getCreateAccountInstruction({
    payer: client.payer, // Account funding account creation.
    newAccount: mint, // New mint account to create.
    lamports: mintRent, // Lamports funding the mint account rent.
    space: mintSpace, // Account size in bytes for the mint plus TransferFeeConfig.
    programAddress: TOKEN_2022_PROGRAM_ADDRESS // Program that owns the mint account.
  }),
  getInitializeTransferFeeConfigInstruction({
    mint: mint.address, // Mint account that stores the TransferFeeConfig extension.
    transferFeeConfigAuthority: client.payer.address, // Authority allowed to update the transfer fee later.
    withdrawWithheldAuthority: client.payer.address, // Value stored in the mint's `withdraw_withheld_authority` field.
    transferFeeBasisPoints: 150, // Transfer fee in basis points.
    maximumFee: 10n // Maximum fee charged on each transfer.
  }),
  getInitializeMintInstruction({
    mint: mint.address, // Mint account to initialize.
    decimals: 2, // Number of decimals for the token.
    mintAuthority: client.payer.address, // Authority allowed to mint new tokens.
    freezeAuthority: client.payer.address // Authority allowed to freeze token accounts.
  })
]);

const [sourceToken] = await findAssociatedTokenPda({
  mint: mint.address,
  owner: client.payer.address,
  tokenProgram: TOKEN_2022_PROGRAM_ADDRESS
});

const [destinationAToken] = await findAssociatedTokenPda({
  mint: mint.address,
  owner: recipientA.address,
  tokenProgram: TOKEN_2022_PROGRAM_ADDRESS
});

const [destinationBToken] = await findAssociatedTokenPda({
  mint: mint.address,
  owner: recipientB.address,
  tokenProgram: TOKEN_2022_PROGRAM_ADDRESS
});

const [feeReceiverToken] = await findAssociatedTokenPda({
  mint: mint.address,
  owner: feeReceiver.address,
  tokenProgram: TOKEN_2022_PROGRAM_ADDRESS
});

await client.sendTransaction([
  await getCreateAssociatedTokenInstructionAsync({
    payer: client.payer,
    mint: mint.address,
    owner: client.payer.address
  }),
  await getCreateAssociatedTokenInstructionAsync({
    payer: client.payer,
    mint: mint.address,
    owner: recipientA.address
  }),
  await getCreateAssociatedTokenInstructionAsync({
    payer: client.payer,
    mint: mint.address,
    owner: recipientB.address
  }),
  await getCreateAssociatedTokenInstructionAsync({
    payer: client.payer,
    mint: mint.address,
    owner: feeReceiver.address
  }),
  getMintToCheckedInstruction({
    mint: mint.address,
    token: sourceToken,
    mintAuthority: client.payer,
    amount: 1_000n,
    decimals: 2
  })
]);

await client.sendTransaction([
  getTransferCheckedWithFeeInstruction({
    source: sourceToken, // Token account sending the transfer.
    mint: mint.address, // Mint with the transfer fee configuration.
    destination: destinationAToken, // Token account receiving the transfer.
    authority: client.payer, // Signer approving the transfer.
    amount: 200n, // Token amount in base units.
    decimals: 2, // Decimals defined on the mint.
    fee: 3n // Expected transfer fee for this transfer.
  })
]);

await client.sendTransaction([
  getWithdrawWithheldTokensFromAccountsInstruction({
    mint: mint.address, // Mint with the transfer fee configuration.
    feeReceiver: feeReceiverToken, // Token account receiving the withdrawn fees.
    withdrawWithheldAuthority: client.payer, // Signer matching the mint's `withdraw_withheld_authority`.
    numTokenAccounts: 1, // Number of token accounts listed in `sources`.
    sources: [destinationAToken] // Token accounts to withdraw withheld fees from.
  })
]);

await client.sendTransaction([
  getTransferCheckedWithFeeInstruction({
    source: sourceToken, // Token account sending the transfer.
    mint: mint.address, // Mint with the transfer fee configuration.
    destination: destinationBToken, // Token account receiving the transfer.
    authority: client.payer, // Signer approving the transfer.
    amount: 200n, // Token amount in base units.
    decimals: 2, // Decimals defined on the mint.
    fee: 3n // Expected transfer fee for this transfer.
  })
]);

await client.sendTransaction([
  getHarvestWithheldTokensToMintInstruction({
    mint: mint.address, // Mint that collects harvested withheld fees.
    sources: [destinationBToken] // Token accounts to harvest withheld fees from.
  })
]);

await client.sendTransaction([
  getWithdrawWithheldTokensFromMintInstruction({
    mint: mint.address, // Mint storing harvested withheld fees.
    feeReceiver: feeReceiverToken, // Token account receiving withdrawn fees.
    withdrawWithheldAuthority: client.payer // Signer matching the mint's `withdraw_withheld_authority`.
  }),
  getSetTransferFeeInstruction({
    mint: mint.address, // Mint whose next transfer fee configuration is updated.
    transferFeeConfigAuthority: client.payer, // Signer authorized to update the transfer fee later.
    transferFeeBasisPoints: 250, // New transfer fee in basis points.
    maximumFee: 25n // New maximum fee for the next transfer fee configuration.
  })
]);

const destinationAAccount = await fetchToken(client.rpc, destinationAToken);
const destinationBAccount = await fetchToken(client.rpc, destinationBToken);
const feeReceiverAccount = await fetchToken(client.rpc, feeReceiverToken);
const mintAccount = await fetchMint(client.rpc, mint.address);
const transferFeeConfig = (
  unwrapOption(mintAccount.data.extensions) ?? []
).find((item) => isExtension("TransferFeeConfig", item));

console.log("Mint Address:", mint.address);
console.dir(
  {
    destinationA: {
      amount: destinationAAccount.data.amount,
      extensions: destinationAAccount.data.extensions
    },
    destinationB: {
      amount: destinationBAccount.data.amount,
      extensions: destinationBAccount.data.extensions
    },
    feeReceiver: {
      amount: feeReceiverAccount.data.amount,
      extensions: feeReceiverAccount.data.extensions
    },
    transferFeeConfig
  },
  { depth: null }
);