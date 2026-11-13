// Moves the NEAR from faucet-funded helper accounts into the master account by
// deleting them with the master as beneficiary. Uses the shared testnet key.
import { connect, keyStores, KeyPair } from "near-api-js";
import fs from "node:fs";

const M = process.env.MASTER_ACCOUNT;
const keyPair = KeyPair.fromString(process.env.MASTER_KEY);
const keyStore = new keyStores.InMemoryKeyStore();
const near = await connect({ networkId: "testnet", nodeUrl: "https://test.rpc.fastnear.com", keyStore });
for (const f of fs.readdirSync("bootstrap").filter((f) => /^fund\d+\.json$/.test(f))) {
  const id = JSON.parse(fs.readFileSync(`bootstrap/${f}`, "utf8")).account_id;
  await keyStore.setKey("testnet", id, keyPair);
  try {
    const a = await near.account(id);
    const bal = await a.getAccountBalance();
    await a.deleteAccount(M);
    console.log(`swept ${id}: ${Number(BigInt(bal.total) / 10n ** 21n) / 1000} NEAR`);
  } catch (e) {
    console.log(`skip ${id}: ${e.message.slice(0, 120)}`);
  }
}
await keyStore.setKey("testnet", M, keyPair);
const m = await near.account(M);
console.log("master available:", Number(BigInt((await m.getAccountBalance()).available) / 10n ** 21n) / 1000, "NEAR");
