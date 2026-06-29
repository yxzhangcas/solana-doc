import {
  lamports,
  createClient,
  appendTransactionMessageInstructions,
  createTransactionMessage,
  generateKeyPairSigner,
  getBase64EncodedWireTransaction,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  unwrapOption
} from "@solana/kit";
import { solanaRpc, rpcAirdrop } from "@solana/kit-plugin-rpc";
import { generatedPayer, airdropPayer } from "@solana/kit-plugin-signer";
import { getCreateAccountInstruction } from "@solana-program/system";
import {
  amountToUiAmountForMintWithoutSimulation,
  extension,
  fetchMint,
  findAssociatedTokenPda,
  getAmountToUiAmountInstruction,
  getCreateAssociatedTokenInstructionAsync,
  getInitializeInterestBearingMintInstruction,
  getInitializeMintInstruction,
  getMintSize,
  getMintToCheckedInstruction,
  getUpdateRateInterestBearingMintInstruction,
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
const recipient = await generateKeyPairSigner();
const tokenAmount = 1_000_000_000_000n;

const interestBearingExtension = extension("InterestBearingConfig", {
  rateAuthority: client.payer.address,
  initializationTimestamp: BigInt(Math.floor(Date.now() / 1000)),
  lastUpdateTimestamp: BigInt(Math.floor(Date.now() / 1000)),
  preUpdateAverageRate: 30000,
  currentRate: 30000
});
const mintSpace = BigInt(getMintSize([interestBearingExtension]));
const mintRent = await client.rpc
  .getMinimumBalanceForRentExemption(mintSpace)
  .send();

const [tokenAccount] = await findAssociatedTokenPda({
  mint: mint.address,
  owner: recipient.address,
  tokenProgram: TOKEN_2022_PROGRAM_ADDRESS
});

await client.sendTransaction([
  getCreateAccountInstruction({
    payer: client.payer, // Account funding the new mint account.
    newAccount: mint, // New mint account to create.
    lamports: mintRent, // Lamports funding the mint account rent.
    space: mintSpace, // Account size in bytes for the mint plus InterestBearingConfig.
    programAddress: TOKEN_2022_PROGRAM_ADDRESS // Program that owns the mint account.
  }),
  getInitializeInterestBearingMintInstruction({
    mint: mint.address, // Mint account that stores the InterestBearingConfig extension.
    rateAuthority: client.payer.address, // Authority allowed to update the interest rate later.
    rate: 30000 // Interest rate in basis points.
  }),
  getInitializeMintInstruction({
    mint: mint.address, // Mint account to initialize.
    decimals: 0, // Number of decimals for the token.
    mintAuthority: client.payer.address, // Authority allowed to mint new tokens.
    freezeAuthority: client.payer.address // Authority allowed to freeze token accounts.
  })
]);

await client.sendTransaction([
  await getCreateAssociatedTokenInstructionAsync({
    payer: client.payer, // Account funding the associated token account creation.
    mint: mint.address, // Mint for the associated token account.
    owner: recipient.address // Owner of the token account.
  }),
  getMintToCheckedInstruction({
    mint: mint.address, // Mint account that issues the tokens.
    token: tokenAccount, // Token account receiving the newly minted tokens.
    mintAuthority: client.payer, // Signer authorized to mint new tokens.
    amount: tokenAmount, // Token amount in base units.
    decimals: 0 // Decimals defined on the mint.
  })
]);

await new Promise((resolve) => setTimeout(resolve, 2_000));

const calculatedUiAmount = await amountToUiAmountForMintWithoutSimulation(
  client.rpc,
  mint.address,
  tokenAmount
);

const amountToUiInstruction = getAmountToUiAmountInstruction({
  mint: mint.address, // Mint whose UI amount conversion is being simulated.
  amount: tokenAmount // Token amount in base units.
});

const { value: latestBlockhash } = await client.rpc.getLatestBlockhash().send();
const amountToUiMessage = pipe(
  createTransactionMessage({ version: 0 }),
  (tx) => setTransactionMessageFeePayerSigner(client.payer, tx),
  (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
  (tx) => appendTransactionMessageInstructions([amountToUiInstruction], tx)
);
const signedAmountToUiMessage =
  await signTransactionMessageWithSigners(amountToUiMessage);
const simulation = await client.rpc
  .simulateTransaction(
    getBase64EncodedWireTransaction(signedAmountToUiMessage),
    {
      encoding: "base64"
    }
  )
  .send();

const simulatedUiAmount = Buffer.from(
  simulation.value.returnData?.data?.[0] ?? "",
  "base64"
).toString("utf8");

const updateRateInstruction = getUpdateRateInterestBearingMintInstruction({
  mint: mint.address, // Mint account that stores the InterestBearingConfig extension.
  rateAuthority: client.payer, // Signer authorized to update the interest rate.
  rate: 15000 // New interest rate in basis points.
});

await client.sendTransaction([updateRateInstruction]);

const mintAccount = await fetchMint(client.rpc, mint.address);
const interestBearingConfig = (
  unwrapOption(mintAccount.data.extensions) ?? []
).find((item) => isExtension("InterestBearingConfig", item));

console.log("Mint Address:", mint.address);
console.log("Token Account:", tokenAccount);
console.log("Calculated UI Amount:", calculatedUiAmount);
console.log("Simulated UI Amount:", simulatedUiAmount);
console.log("InterestBearingConfig:", interestBearingConfig);