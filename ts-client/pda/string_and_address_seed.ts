import {
  Address,
  getAddressEncoder,
  getProgramDerivedAddress
} from "@solana/kit";

async function main() {
  const programAddress = "11111111111111111111111111111111" as Address;
  const optionalSeedString = "helloWorld";
  const addressEncoder = getAddressEncoder();
  const optionalSeedAddress = addressEncoder.encode(
    "B9Lf9z5BfNPT4d5KMeaBFx8x1G4CULZYR1jA2kmxRDka" as Address
  );
  const seeds = [optionalSeedString, optionalSeedAddress];
  const [pda, bump] = await getProgramDerivedAddress({
    programAddress,
    seeds
  });

  console.log(`PDA: ${pda}`);
  console.log(`Bump: ${bump}`);
}

main();