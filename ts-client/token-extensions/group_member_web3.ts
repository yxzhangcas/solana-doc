import {
  Connection,
  Keypair,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  ExtensionType,
  getMintLen,
  getMint,
  createInitializeMintInstruction,
  createInitializeGroupPointerInstruction,
  createInitializeGroupInstruction,
  createInitializeGroupMemberPointerInstruction,
  createInitializeMemberInstruction,
  getGroupPointerState,
  getGroupMemberPointerState,
  getTokenGroupState,
  getTokenGroupMemberState
} from "@solana/spl-token";

const connection = new Connection("http://localhost:8899", "confirmed");

const authority = Keypair.generate();

const airdropSignature = await connection.requestAirdrop(
  authority.publicKey,
  5 * LAMPORTS_PER_SOL
);
await connection.confirmTransaction(airdropSignature, "confirmed");

const groupMint = Keypair.generate();

const groupPointerExtensions = [ExtensionType.GroupPointer];
const spaceWithGroupPointerExtensions = getMintLen(groupPointerExtensions);

const groupAndGroupPointerExtensions = [
  ExtensionType.GroupPointer,
  ExtensionType.TokenGroup
];
const spaceWithGroupAndGroupPointerExtensions = getMintLen(
  groupAndGroupPointerExtensions
);

const groupMintRent = await connection.getMinimumBalanceForRentExemption(
  spaceWithGroupAndGroupPointerExtensions
);

const { blockhash: latestBlockhash } = await connection.getLatestBlockhash();

const createGroupMintAccountInstruction = SystemProgram.createAccount({
  fromPubkey: authority.publicKey, // Account funding the new mint account.
  newAccountPubkey: groupMint.publicKey, // New group mint account to create.
  lamports: groupMintRent, // Lamports funding the mint account rent.
  space: spaceWithGroupPointerExtensions, // Account size in bytes for the mint plus GroupPointer.
  programId: TOKEN_2022_PROGRAM_ID // Program that owns the mint account.
});

const initializeGroupPointerInstruction =
  createInitializeGroupPointerInstruction(
    groupMint.publicKey, // Mint account that stores the GroupPointer extension.
    authority.publicKey, // Authority allowed to update the group pointer later.
    groupMint.publicKey, // Account address that stores the group data.
    TOKEN_2022_PROGRAM_ID // Program that owns the mint account.
  );

const initializeGroupMintInstruction = createInitializeMintInstruction(
  groupMint.publicKey, // Mint account to initialize.
  0, // Number of decimals for the token.
  authority.publicKey, // Authority allowed to mint new tokens.
  authority.publicKey, // Authority allowed to freeze token accounts.
  TOKEN_2022_PROGRAM_ID // Program that owns the mint account.
);

const initializeGroupInstruction = createInitializeGroupInstruction({
  programId: TOKEN_2022_PROGRAM_ID, // Token program that owns the mint.
  group: groupMint.publicKey, // Mint account that stores the group data.
  mint: groupMint.publicKey, // Mint that the group data describes.
  mintAuthority: authority.publicKey, // Signer authorizing group initialization for the mint.
  updateAuthority: authority.publicKey, // Authority allowed to update the group later.
  maxSize: 10n // Maximum number of members allowed in the group.
});

const groupTransaction = new Transaction({
  feePayer: authority.publicKey,
  recentBlockhash: latestBlockhash
}).add(
  createGroupMintAccountInstruction,
  initializeGroupPointerInstruction,
  initializeGroupMintInstruction,
  initializeGroupInstruction
);

await sendAndConfirmTransaction(
  connection,
  groupTransaction,
  [authority, groupMint],
  {
    commitment: "confirmed",
    skipPreflight: true
  }
);

const memberMint = Keypair.generate();

const memberPointerExtensions = [ExtensionType.GroupMemberPointer];
const spaceWithMemberPointerExtension = getMintLen(memberPointerExtensions);

const memberAndMemberPointerExtensions = [
  ExtensionType.GroupMemberPointer,
  ExtensionType.TokenGroupMember
];
const spaceWithMemberAndMemberPointerExtensions = getMintLen(
  memberAndMemberPointerExtensions
);

const memberMintRent = await connection.getMinimumBalanceForRentExemption(
  spaceWithMemberAndMemberPointerExtensions
);

const { blockhash: memberLatestBlockhash } =
  await connection.getLatestBlockhash();

const createMemberMintAccountInstruction = SystemProgram.createAccount({
  fromPubkey: authority.publicKey, // Account funding the new mint account.
  newAccountPubkey: memberMint.publicKey, // New member mint account to create.
  lamports: memberMintRent, // Lamports funding the mint account rent.
  space: spaceWithMemberPointerExtension, // Account size in bytes for the mint plus GroupMemberPointer.
  programId: TOKEN_2022_PROGRAM_ID // Program that owns the mint account.
});

const initializeMemberPointerInstruction =
  createInitializeGroupMemberPointerInstruction(
    memberMint.publicKey, // Mint account that stores the GroupMemberPointer extension.
    authority.publicKey, // Authority allowed to update the member pointer later.
    memberMint.publicKey, // Account address that stores the member data.
    TOKEN_2022_PROGRAM_ID // Program that owns the mint account.
  );

const initializeMemberMintInstruction = createInitializeMintInstruction(
  memberMint.publicKey, // Mint account to initialize.
  0, // Number of decimals for the token.
  authority.publicKey, // Authority allowed to mint new tokens.
  authority.publicKey, // Authority allowed to freeze token accounts.
  TOKEN_2022_PROGRAM_ID // Program that owns the mint account.
);

const initializeMemberInstruction = createInitializeMemberInstruction({
  programId: TOKEN_2022_PROGRAM_ID, // Token program that owns the mint.
  member: memberMint.publicKey, // Mint account that stores the member data.
  memberMint: memberMint.publicKey, // Mint that the member data describes.
  memberMintAuthority: authority.publicKey, // Signer authorizing member initialization for the mint.
  group: groupMint.publicKey, // Group mint that this member belongs to.
  groupUpdateAuthority: authority.publicKey // Signer matching the group's update authority.
});

const memberTransaction = new Transaction({
  feePayer: authority.publicKey,
  recentBlockhash: memberLatestBlockhash
}).add(
  createMemberMintAccountInstruction,
  initializeMemberPointerInstruction,
  initializeMemberMintInstruction,
  initializeMemberInstruction
);

await sendAndConfirmTransaction(
  connection,
  memberTransaction,
  [authority, memberMint],
  {
    commitment: "confirmed",
    skipPreflight: true
  }
);

const groupMintAccount = await getMint(
  connection,
  groupMint.publicKey,
  "confirmed",
  TOKEN_2022_PROGRAM_ID
);
const memberMintAccount = await getMint(
  connection,
  memberMint.publicKey,
  "confirmed",
  TOKEN_2022_PROGRAM_ID
);

console.log(
  JSON.stringify(
    {
      groupMint: groupMint.publicKey,
      groupPointer: getGroupPointerState(groupMintAccount),
      group: getTokenGroupState(groupMintAccount),
      memberMint: memberMint.publicKey,
      memberPointer: getGroupMemberPointerState(memberMintAccount),
      member: getTokenGroupMemberState(memberMintAccount)
    },
    (_, value) => (typeof value === "bigint" ? value.toString() : value),
    2
  )
);