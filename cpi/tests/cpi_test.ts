import { AnchorProvider, getProvider, Program, setProvider, Wallet, workspace } from "@anchor-lang/core";
import { PublicKey } from "@solana/web3.js";
import type { Cpi } from "../target/types/cpi.js";

describe("cpi", () => {
  setProvider(AnchorProvider.env());
  const program = workspace.Cpi as Program<Cpi>;
  const wallet = getProvider().wallet as Wallet;
  const connection = getProvider().connection;
  const [messagePda, messageBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("message"), wallet.publicKey.toBuffer()],
    program.programId
  );
  const [vaultPda, vaultBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), wallet.publicKey.toBuffer()],
    program.programId
  );
  it("Create Message Account", async () => {
    const message = "Hello, World!";
    const transactionSignature = await program.methods
      .create(message)
      .accounts({})
      .rpc({ commitment: "confirmed" });

    const messageAccount = await program.account.messageAccount.fetch(
      messagePda,
      "confirmed"
    );

    const vaultBalance = await connection.getBalance(vaultPda);
    console.log("Vault Balance:", vaultBalance);

    console.log(JSON.stringify(messageAccount, null, 2));
    console.log("Transaction Signature:", transactionSignature);
  });

  it("Update Message Account", async () => {
    const message = "Hello, Solana!";
    const transactionSignature = await program.methods
      .update(message)
      .accounts({})
      .rpc({ commitment: "confirmed" });

    const messageAccount = await program.account.messageAccount.fetch(
      messagePda,
      "confirmed"
    );

    const vaultBalance = await connection.getBalance(vaultPda);
    console.log("Vault Balance:", vaultBalance);

    console.log(JSON.stringify(messageAccount, null, 2));
    console.log("Transaction Signature:", transactionSignature);
  });

  it("Delete Message Account", async () => {
    const transactionSignature = await program.methods
      .delete()
      .accounts({})
      .rpc({ commitment: "confirmed" });

    const messageAccount = await program.account.messageAccount.fetchNullable(
      messagePda,
      "confirmed"
    );

    const vaultBalance = await connection.getBalance(vaultPda);
    console.log("Vault Balance:", vaultBalance);

    console.log("Expect Null:", JSON.stringify(messageAccount, null, 2));
    console.log("Transaction Signature:", transactionSignature);
  });
});