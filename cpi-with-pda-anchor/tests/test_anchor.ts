import * as anchor from "@coral-xyz/anchor";

import { BN, Program } from "@coral-xyz/anchor";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

import { CpiWithPdaAnchor } from "../target/types/cpi_with_pda_anchor";

describe("cpi_with_pda_anchor", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.CpiWithPdaAnchor as Program<CpiWithPdaAnchor>;
  const connection = program.provider.connection;
  const wallet = provider.wallet as anchor.Wallet;

  const [PDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("pda"), wallet.publicKey.toBuffer()],
    program.programId
  );

  const transferAmount = 0.1 * LAMPORTS_PER_SOL;

  before(async () => {
    // Request airdrop to fund PDA
    const signature = await connection.requestAirdrop(PDA, transferAmount * 3);

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash();

    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight
    });
  });

  it("SOL Transfer with PDA signer 1", async () => {
    const transactionSignature = await program.methods
      .solTransfer(new BN(transferAmount))
      .accounts({
        recipient: wallet.publicKey
      })
      .rpc();

    console.log(`\nTransaction Signature: ${transactionSignature}`);
  });

    it("SOL Transfer with PDA signer 2", async () => {
    const transactionSignature = await program.methods
      .solTransferV2(new BN(transferAmount))
      .accounts({
        recipient: wallet.publicKey
      })
      .rpc();

    console.log(`\nTransaction Signature: ${transactionSignature}`);
  });

    it("SOL Transfer with PDA signer 3", async () => {
    const transactionSignature = await program.methods
      .solTransferV3(new BN(transferAmount))
      .accounts({
        recipient: wallet.publicKey
      })
      .rpc();

    console.log(`\nTransaction Signature: ${transactionSignature}`);
  });
});