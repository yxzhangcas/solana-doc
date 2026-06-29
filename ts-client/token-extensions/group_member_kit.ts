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
  getInitializeGroupMemberPointerInstruction,
  getInitializeGroupPointerInstruction,
  getInitializeMintInstruction,
  getInitializeTokenGroupInstruction,
  getInitializeTokenGroupMemberInstruction,
  getMintSize,
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

const groupMint = await generateKeyPairSigner();
const memberMint = await generateKeyPairSigner();

const groupPointerExtension = extension("GroupPointer", {
  authority: client.payer.address,
  groupAddress: groupMint.address
});
const groupExtension = extension("TokenGroup", {
  updateAuthority: client.payer.address,
  mint: groupMint.address,
  size: 0n,
  maxSize: 10n
});
const groupMintSpace = BigInt(
  getMintSize([groupPointerExtension, groupExtension])
);
const groupMintCreateSpace = BigInt(getMintSize([groupPointerExtension]));
const groupMintRent = await client.rpc
  .getMinimumBalanceForRentExemption(groupMintSpace)
  .send();

await client.sendTransaction([
  getCreateAccountInstruction({
    payer: client.payer, // Account funding the new mint account.
    newAccount: groupMint, // New group mint account to create.
    lamports: groupMintRent, // Lamports funding the mint account rent.
    space: groupMintCreateSpace, // Account size in bytes for the mint plus GroupPointer.
    programAddress: TOKEN_2022_PROGRAM_ADDRESS // Program that owns the mint account.
  }),
  getInitializeGroupPointerInstruction({
    mint: groupMint.address, // Mint account that stores the GroupPointer extension.
    authority: client.payer.address, // Authority allowed to update the group pointer later.
    groupAddress: groupMint.address // Account address that stores the group data.
  }),
  getInitializeMintInstruction({
    mint: groupMint.address, // Mint account to initialize.
    decimals: 0, // Number of decimals for the token.
    mintAuthority: client.payer.address, // Authority allowed to mint new tokens.
    freezeAuthority: client.payer.address // Authority allowed to freeze token accounts.
  }),
  getInitializeTokenGroupInstruction({
    group: groupMint.address, // Mint account that stores the group data.
    mint: groupMint.address, // Mint that the group data describes.
    mintAuthority: client.payer, // Signer authorizing group initialization for the mint.
    updateAuthority: client.payer.address, // Authority allowed to update the group later.
    maxSize: 10n // Maximum number of members allowed in the group.
  })
]);

const memberPointerExtension = extension("GroupMemberPointer", {
  authority: client.payer.address,
  memberAddress: memberMint.address
});
const memberExtension = extension("TokenGroupMember", {
  mint: memberMint.address,
  group: groupMint.address,
  memberNumber: 1n
});
const memberMintSpace = BigInt(
  getMintSize([memberPointerExtension, memberExtension])
);
const memberMintCreateSpace = BigInt(getMintSize([memberPointerExtension]));
const memberMintRent = await client.rpc
  .getMinimumBalanceForRentExemption(memberMintSpace)
  .send();

await client.sendTransaction([
  getCreateAccountInstruction({
    payer: client.payer, // Account funding the new mint account.
    newAccount: memberMint, // New member mint account to create.
    lamports: memberMintRent, // Lamports funding the mint account rent.
    space: memberMintCreateSpace, // Account size in bytes for the mint plus GroupMemberPointer.
    programAddress: TOKEN_2022_PROGRAM_ADDRESS // Program that owns the mint account.
  }),
  getInitializeGroupMemberPointerInstruction({
    mint: memberMint.address, // Mint account that stores the GroupMemberPointer extension.
    authority: client.payer.address, // Authority allowed to update the member pointer later.
    memberAddress: memberMint.address // Account address that stores the member data.
  }),
  getInitializeMintInstruction({
    mint: memberMint.address, // Mint account to initialize.
    decimals: 0, // Number of decimals for the token.
    mintAuthority: client.payer.address, // Authority allowed to mint new tokens.
    freezeAuthority: client.payer.address // Authority allowed to freeze token accounts.
  }),
  getInitializeTokenGroupMemberInstruction({
    member: memberMint.address, // Mint account that stores the member data.
    memberMint: memberMint.address, // Mint that the member data describes.
    memberMintAuthority: client.payer, // Signer authorizing member initialization for the mint.
    group: groupMint.address, // Group mint that this member belongs to.
    groupUpdateAuthority: client.payer // Signer matching the group's update authority.
  })
]);

const groupMintAccount = await fetchMint(client.rpc, groupMint.address);
const memberMintAccount = await fetchMint(client.rpc, memberMint.address);
const groupExtensions = unwrapOption(groupMintAccount.data.extensions) ?? [];
const memberExtensions = unwrapOption(memberMintAccount.data.extensions) ?? [];

console.log(
  JSON.stringify(
    {
      groupMint: groupMint.address,
      groupPointer: groupExtensions.find((item) =>
        isExtension("GroupPointer", item)
      ),
      group: groupExtensions.find((item) => isExtension("TokenGroup", item)),
      memberMint: memberMint.address,
      memberPointer: memberExtensions.find((item) =>
        isExtension("GroupMemberPointer", item)
      ),
      member: memberExtensions.find((item) =>
        isExtension("TokenGroupMember", item)
      )
    },
    (_, value) => (typeof value === "bigint" ? value.toString() : value),
    2
  )
);