import { generateKeyPairSigner } from "@solana/kit";

async function main() {
  // Kit does not enable extractable private keys
  const keypairSigner = await generateKeyPairSigner();
  console.log(keypairSigner);
}

main();