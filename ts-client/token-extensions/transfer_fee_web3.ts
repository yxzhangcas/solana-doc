import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  ExtensionType,
  createAssociatedTokenAccountInstruction,
  createHarvestWithheldTokensToMintInstruction,
  createInitializeMintInstruction,
  createInitializeTransferFeeConfigInstruction,
  createMintToCheckedInstruction,
  createSetTransferFeeInstruction,
  createTransferCheckedWithFeeInstruction,
  createWithdrawWithheldTokensFromAccountsInstruction,
  createWithdrawWithheldTokensFromMintInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  getMint,
  getMintLen,
  getTransferFeeAmount,
  getTransferFeeConfig,
  TOKEN_2022_PROGRAM_ID
} from "@solana/spl-token";

const connection = new Connection("http://localhost:8899", "confirmed");
const latestBlockhash = await connection.getLatestBlockhash();

const feePayer = Keypair.generate();
const recipientA = Keypair.generate();
const recipientB = Keypair.generate();
const feeReceiver = Keypair.generate();
const airdropSignature = await connection.requestAirdrop(
  feePayer.publicKey,
  5 * LAMPORTS_PER_SOL
);
await connection.confirmTransaction({
  blockhash: latestBlockhash.blockhash,
  lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
  signature: airdropSignature
});

const mint = Keypair.generate();
const transferFeeConfigExtensions = [ExtensionType.TransferFeeConfig];
const mintLen = getMintLen(transferFeeConfigExtensions);
const mintRent = await connection.getMinimumBalanceForRentExemption(mintLen);

const sourceToken = getAssociatedTokenAddressSync(
  mint.publicKey,
  feePayer.publicKey,
  false,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
);

const destinationAToken = getAssociatedTokenAddressSync(
  mint.publicKey,
  recipientA.publicKey,
  false,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
);

const destinationBToken = getAssociatedTokenAddressSync(
  mint.publicKey,
  recipientB.publicKey,
  false,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
);

const feeReceiverToken = getAssociatedTokenAddressSync(
  mint.publicKey,
  feeReceiver.publicKey,
  false,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
);

await sendAndConfirmTransaction(
  connection,
  new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: feePayer.publicKey, // Account funding account creation.
      newAccountPubkey: mint.publicKey, // New mint account to create.
      lamports: mintRent, // Lamports funding the mint account rent.
      space: mintLen, // Account size in bytes for the mint plus TransferFeeConfig.
      programId: TOKEN_2022_PROGRAM_ID // Program that owns the mint account.
    }),
    createInitializeTransferFeeConfigInstruction(
      mint.publicKey, // Mint account that stores the TransferFeeConfig extension.
      feePayer.publicKey, // Authority allowed to update the transfer fee later.
      feePayer.publicKey, // Value stored in the mint's `withdraw_withheld_authority` field.
      150, // Transfer fee in basis points.
      10n, // Maximum fee charged on each transfer.
      TOKEN_2022_PROGRAM_ID // Token program that owns the mint.
    ),
    createInitializeMintInstruction(
      mint.publicKey, // Mint account to initialize.
      2, // Number of decimals for the token.
      feePayer.publicKey, // Authority allowed to mint new tokens.
      feePayer.publicKey, // Authority allowed to freeze token accounts.
      TOKEN_2022_PROGRAM_ID // Program that owns the mint account.
    )
  ),
  [feePayer, mint],
  { commitment: "confirmed" }
);

await sendAndConfirmTransaction(
  connection,
  new Transaction().add(
    createAssociatedTokenAccountInstruction(
      feePayer.publicKey,
      sourceToken,
      feePayer.publicKey,
      mint.publicKey,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    ),
    createAssociatedTokenAccountInstruction(
      feePayer.publicKey,
      destinationAToken,
      recipientA.publicKey,
      mint.publicKey,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    ),
    createAssociatedTokenAccountInstruction(
      feePayer.publicKey,
      destinationBToken,
      recipientB.publicKey,
      mint.publicKey,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    ),
    createAssociatedTokenAccountInstruction(
      feePayer.publicKey,
      feeReceiverToken,
      feeReceiver.publicKey,
      mint.publicKey,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    ),
    createMintToCheckedInstruction(
      mint.publicKey,
      sourceToken,
      feePayer.publicKey,
      1_000,
      2,
      [],
      TOKEN_2022_PROGRAM_ID
    )
  ),
  [feePayer],
  { commitment: "confirmed" }
);

await sendAndConfirmTransaction(
  connection,
  new Transaction().add(
    createTransferCheckedWithFeeInstruction(
      sourceToken, // Token account sending the transfer.
      mint.publicKey, // Mint with the transfer fee configuration.
      destinationAToken, // Token account receiving the transfer.
      feePayer.publicKey, // Signer approving the transfer.
      200n, // Token amount in base units.
      2, // Decimals defined on the mint.
      3n, // Expected transfer fee for this transfer.
      [], // Additional multisig signers.
      TOKEN_2022_PROGRAM_ID // Token program that processes the transfer.
    )
  ),
  [feePayer],
  { commitment: "confirmed" }
);

await sendAndConfirmTransaction(
  connection,
  new Transaction().add(
    createWithdrawWithheldTokensFromAccountsInstruction(
      mint.publicKey, // Mint with the transfer fee configuration.
      feeReceiverToken, // Token account receiving the withdrawn fees.
      feePayer.publicKey, // Signer matching the mint's `withdraw_withheld_authority`.
      [], // Additional multisig signers.
      [destinationAToken], // Token accounts to withdraw withheld fees from.
      TOKEN_2022_PROGRAM_ID // Token program that processes the withdraw.
    )
  ),
  [feePayer],
  { commitment: "confirmed" }
);

await sendAndConfirmTransaction(
  connection,
  new Transaction().add(
    createTransferCheckedWithFeeInstruction(
      sourceToken, // Token account sending the transfer.
      mint.publicKey, // Mint with the transfer fee configuration.
      destinationBToken, // Token account receiving the transfer.
      feePayer.publicKey, // Signer approving the transfer.
      200n, // Token amount in base units.
      2, // Decimals defined on the mint.
      3n, // Expected transfer fee for this transfer.
      [], // Additional multisig signers.
      TOKEN_2022_PROGRAM_ID // Token program that processes the transfer.
    )
  ),
  [feePayer],
  { commitment: "confirmed" }
);

await sendAndConfirmTransaction(
  connection,
  new Transaction().add(
    createHarvestWithheldTokensToMintInstruction(
      mint.publicKey, // Mint that collects harvested withheld fees.
      [destinationBToken], // Token accounts to harvest withheld fees from.
      TOKEN_2022_PROGRAM_ID // Token program that processes the harvest.
    )
  ),
  [feePayer],
  { commitment: "confirmed" }
);

await sendAndConfirmTransaction(
  connection,
  new Transaction().add(
    createWithdrawWithheldTokensFromMintInstruction(
      mint.publicKey, // Mint storing harvested withheld fees.
      feeReceiverToken, // Token account receiving withdrawn fees.
      feePayer.publicKey, // Signer matching the mint's `withdraw_withheld_authority`.
      [], // Additional multisig signers.
      TOKEN_2022_PROGRAM_ID // Token program that processes the withdraw.
    ),
    createSetTransferFeeInstruction(
      mint.publicKey, // Mint whose next transfer fee configuration is updated.
      feePayer.publicKey, // Authority allowed to update the transfer fee later.
      [], // Additional multisig signers.
      250, // New transfer fee in basis points.
      25n, // New maximum fee for the next transfer fee configuration.
      TOKEN_2022_PROGRAM_ID // Token program that owns the mint.
    )
  ),
  [feePayer],
  { commitment: "confirmed" }
);

const destinationAAccount = await getAccount(
  connection,
  destinationAToken,
  "confirmed",
  TOKEN_2022_PROGRAM_ID
);
const destinationBAccount = await getAccount(
  connection,
  destinationBToken,
  "confirmed",
  TOKEN_2022_PROGRAM_ID
);
const feeReceiverAccount = await getAccount(
  connection,
  feeReceiverToken,
  "confirmed",
  TOKEN_2022_PROGRAM_ID
);
const mintAccount = await getMint(
  connection,
  mint.publicKey,
  "confirmed",
  TOKEN_2022_PROGRAM_ID
);

console.log("Mint Address:", mint.publicKey.toBase58());
console.log("Destination A Amount:", destinationAAccount.amount.toString());
console.log(
  "Destination A Transfer Fee Amount:",
  getTransferFeeAmount(destinationAAccount)
);
console.log("Destination B Amount:", destinationBAccount.amount.toString());
console.log(
  "Destination B Transfer Fee Amount:",
  getTransferFeeAmount(destinationBAccount)
);
console.log("Fee Receiver Amount:", feeReceiverAccount.amount.toString());
console.log(
  "Fee Receiver Transfer Fee Amount:",
  getTransferFeeAmount(feeReceiverAccount)
);
console.log("Transfer Fee Config:", getTransferFeeConfig(mintAccount));