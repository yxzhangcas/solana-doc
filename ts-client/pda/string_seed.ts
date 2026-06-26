import { Address, getProgramDerivedAddress } from "@solana/kit";

async function main() {
  const programAddress = "11111111111111111111111111111111" as Address;
  const seeds = ["helloWorld"];
  const [pda, bump] = await getProgramDerivedAddress({
    programAddress,
    seeds
  });

  console.log(`PDA: ${pda}`);
  console.log(`Bump: ${bump}`);
}

main();