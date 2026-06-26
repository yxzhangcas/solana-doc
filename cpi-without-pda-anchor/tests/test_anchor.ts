import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { CpiWithoutPdaAnchor } from "../target/types/cpi_without_pda_anchor";

describe("cpi_without_pda_anchor", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.CpiWithoutPdaAnchor as Program<CpiWithoutPdaAnchor>;
  const sender = provider.wallet as anchor.Wallet;
  const recipient = new Keypair();

  const transferAmount = 0.01 * LAMPORTS_PER_SOL;

  it("SOL Transfer Anchor 1", async () => {
    const transactionSignature = await program.methods
      .solTransfer(new BN(transferAmount))
      .accounts({
        sender: sender.publicKey,
        recipient: recipient.publicKey
      })
      .rpc();
    console.log(`\nTransaction Signature: ${transactionSignature}`);
  });
  it("SOL Transfer Anchor 2", async () => {
    const transactionSignature = await program.methods
      .solTransferV2(new BN(transferAmount))
      .accounts({
        sender: sender.publicKey,
        recipient: recipient.publicKey
      })
      .rpc();
    console.log(`\nTransaction Signature: ${transactionSignature}`);
  });
  it("SOL Transfer Anchor 3", async () => {
    const transactionSignature = await program.methods
      .solTransferV3(new BN(transferAmount))
      .accounts({
        sender: sender.publicKey,
        recipient: recipient.publicKey
      })
      .rpc();
    console.log(`\nTransaction Signature: ${transactionSignature}`);
  });
});