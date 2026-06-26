import { PublicKey } from "@solana/web3.js";

async function main() {
  const programId = new PublicKey("11111111111111111111111111111111");
  const optionalSeed = "helloWorld";

  // Loop through all bump seeds (255 down to 0)
  for (let bump = 255; bump >= 0; bump--) {
    try {
      // create: 直接尝试创建
      const PDA = PublicKey.createProgramAddressSync(
        [Buffer.from(optionalSeed), Buffer.from([bump])],
        programId
      );
      console.log("bump " + bump + ": " + PDA);
    } catch (error) {
      console.log("bump " + bump + ": " + error);
    }
  }
}

main();