import {
  type Address,
  createSolanaRpc,
  fetchJsonParsedAccount,
  isOffCurveAddress
} from "@solana/kit";

const rpc = createSolanaRpc("http://localhost:8899");

const SYSTEM_PROGRAM = "11111111111111111111111111111111" as Address;

/**
 * Throws if `recipient` cannot safely receive native SOL.
 *
 * Only System Program wallets (or unfunded on-curve addresses) are safe. Any
 * other account locks the lamports because no authority can debit them.
 */
async function assertSafeSolRecipient(recipient: Address): Promise<void> {
  const account = await fetchJsonParsedAccount(rpc, recipient);

  if (!account.exists) {
    // Off-curve = a PDA with no account; reject conservatively.
    if (isOffCurveAddress(recipient)) {
      throw new Error(
        `Recipient ${recipient} is a PDA with no account; SOL would be locked`
      );
    }
    // On-curve = an unfunded wallet, safe to fund.
    return;
  }

  if (account.programAddress !== SYSTEM_PROGRAM) {
    throw new Error(
      `Recipient is owned by ${account.programAddress}, not a wallet; SOL would be locked`
    );
  }
}

async function main() {
  // A wallet: safe.
  await assertSafeSolRecipient(
    "H8sMJSCQxfKiFTCfDR3DUMLPwcRbM61LGFJ8N4dK3WjS" as Address
  );

  // The USDC mint: rejected before any SOL leaves the sender.
  await assertSafeSolRecipient(
    "So11111111111111111111111111111111111111111" as Address
  );
}

main();