// No imports needed: web3, anchor, pg and more are globally available

import { AnchorProvider, getProvider, Program, setProvider, Wallet, web3, workspace } from "@anchor-lang/core";
import { BN } from "bn.js";
import { assert } from "chai";
import type { HelloAnchor } from "../target/types/hello_anchor.js";

describe("Test", () => {
  setProvider(AnchorProvider.env());
  const program = workspace.HelloAnchor as Program<HelloAnchor>;
  const wallet = getProvider().wallet as Wallet;
  const connection = getProvider().connection;
  it("initialize", async () => {
    // Generate keypair for the new account
    const newAccountKp = new web3.Keypair();

    // Send transaction
    const data = new BN(42);
    const txHash = await program.methods
      .initialize(data)
      .accounts({
        newAccount: newAccountKp.publicKey,
        signer: wallet.publicKey,
      })
      .signers([newAccountKp])
      .rpc();
    console.log(`Use 'solana confirm -v ${txHash}' to see the logs`);

    // Confirm transaction
    await connection.confirmTransaction(txHash);

    // Fetch the created account
    const newAccount = await program.account.newAccount.fetch(
      newAccountKp.publicKey
    );

    console.log("Onchain data is:", newAccount.data.toString());

    // Check whether the data onchain is equal to local 'data'
    assert(data.eq(newAccount.data));
  });
});