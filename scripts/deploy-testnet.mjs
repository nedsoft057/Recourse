// Deploys Recourse to NEAR testnet and sets up the demo accounts.
// Run by .github/workflows/deploy-testnet.yml. Safe to re-run: existing
// accounts are reused and already-initialised contracts are only upgraded.
//
// Env:
//   MASTER_ACCOUNT  e.g. favour-recourse.testnet (a fresh account used only for this)
//   MASTER_KEY      its private key, ed25519:...
//   WINDOW_MINUTES  response / appeal window for the demo (default 3)
//   REVIEW_MINUTES  human review deadline for the demo (default 10)
//   RESET           "true" deletes and recreates the contract accounts first
//
// Demo note: all sub-accounts share the master key. That's fine for a testnet
// demo; production would give the judge and relayer their own keys.

import fs from "node:fs";
import { connect, keyStores, KeyPair, utils } from "near-api-js";

const M = process.env.MASTER_ACCOUNT;
const SK = process.env.MASTER_KEY;
if (!M || !SK) throw new Error("MASTER_ACCOUNT and MASTER_KEY are required");
const WINDOW_MS = Number(process.env.WINDOW_MINUTES || 3) * 60_000;
const REVIEW_MS = Number(process.env.REVIEW_MINUTES || 10) * 60_000;
const RESET = process.env.RESET === "true";
const RPC = process.env.NEAR_RPC || "https://test.rpc.fastnear.com";

const near = (n) => BigInt(utils.format.parseNearAmount(String(n)));
const TGAS = 1_000_000_000_000n;
const USDC = 1_000_000n;

const ids = {
  recourse: `recourse.${M}`,
  token: `usdc.${M}`,
  judge: `judge.${M}`,
  relayer: `relayer.${M}`,
  shops: [`atelier.${M}`, `loomhouse.${M}`, `fieldkit.${M}`],
  buyers: [`buyer-a.${M}`, `buyer-b.${M}`],
};
const funding = {
  [ids.recourse]: "3.8",
  [ids.token]: "1.8",
  [ids.judge]: "0.1",
  [ids.relayer]: "0.1",
  ...Object.fromEntries(ids.shops.map((s) => [s, "0.35"])),
  ...Object.fromEntries(ids.buyers.map((b) => [b, "0.1"])),
};
const shopNames = {
  [ids.shops[0]]: "Atelier Ama",
  [ids.shops[1]]: "Loom House",
  [ids.shops[2]]: "Field Kit Supply",
};

const keyPair = KeyPair.fromString(SK);
const keyStore = new keyStores.InMemoryKeyStore();
for (const id of [M, ...Object.keys(funding)]) await keyStore.setKey("testnet", id, keyPair);
const conn = await connect({ networkId: "testnet", nodeUrl: RPC, keyStore });
const acct = (id) => conn.account(id);
const master = await acct(M);

async function exists(id) {
  try {
    await (await acct(id)).state();
    return true;
  } catch {
    return false;
  }
}

async function ensureAccount(id) {
  if (await exists(id)) {
    console.log(`= ${id} exists`);
    return;
  }
  await master.createAccount(id, keyPair.getPublicKey(), near(funding[id]));
  console.log(`+ created ${id} with ${funding[id]} NEAR`);
}

async function call(signer, contractId, methodName, args = {}, deposit = "0", gas = 100n) {
  const a = await acct(signer);
  const res = await a.functionCall({
    contractId,
    methodName,
    args,
    gas: gas * TGAS,
    attachedDeposit: deposit === "1yocto" ? 1n : near(deposit),
  });
  console.log(`  ${signer} -> ${contractId}.${methodName}`);
  return res;
}

async function view(contractId, methodName, args = {}) {
  return master.viewFunction({ contractId, methodName, args });
}

async function initialised(contractId, method) {
  try {
    await view(contractId, method);
    return true;
  } catch {
    return false;
  }
}

// 0. Optional reset of the contract accounts.
if (RESET) {
  for (const id of [ids.recourse, ids.token]) {
    if (await exists(id)) {
      await (await acct(id)).deleteAccount(M);
      console.log(`- deleted ${id}`);
    }
  }
}

// 1. Accounts.
console.log(`Master: ${M}`);
for (const id of Object.keys(funding)) await ensureAccount(id);

// 2. Test USDC.
await (await acct(ids.token)).deployContract(fs.readFileSync("out/test_usdc.wasm"));
console.log(`deployed ${ids.token}`);
if (!(await initialised(ids.token, "ft_metadata"))) {
  await call(ids.token, ids.token, "new", { owner: M });
}

// 3. Recourse.
await (await acct(ids.recourse)).deployContract(fs.readFileSync("out/recourse.wasm"));
console.log(`deployed ${ids.recourse}`);
if (!(await initialised(ids.recourse, "get_config"))) {
  await call(ids.recourse, ids.recourse, "new", {
    owner: M,
    judge: ids.judge,
    relayer: ids.relayer,
    token: ids.token,
    response_ms: WINDOW_MS,
    appeal_ms: WINDOW_MS,
    review_ms: REVIEW_MS,
  });
} else {
  await call(M, ids.recourse, "set_windows", {
    response_ms: WINDOW_MS,
    appeal_ms: WINDOW_MS,
    review_ms: REVIEW_MS,
  });
}

// 4. Token registration for everyone who will hold or receive tUSDC.
for (const id of [ids.recourse, ids.relayer, ...ids.shops, ...ids.buyers]) {
  const bal = await view(ids.token, "storage_balance_of", { account_id: id });
  if (!bal) await call(M, ids.token, "storage_deposit", { account_id: id, registration_only: true }, "0.01");
}

// 5. Demo money for buyers (tops up to 1,000 tUSDC each).
for (const b of ids.buyers) {
  const bal = BigInt(await view(ids.token, "ft_balance_of", { account_id: b }));
  const target = 1000n * USDC;
  if (bal < target) await call(M, ids.token, "mint", { account_id: b, amount: String(target - bal) });
}

// 6. Demo sellers: register and approve.
for (const s of ids.shops) {
  const m = await view(ids.recourse, "get_merchant", { account_id: s });
  if (!m) await call(s, ids.recourse, "register_merchant", { name: shopNames[s] }, "0.2");
  const after = await view(ids.recourse, "get_merchant", { account_id: s });
  if (after.merchant.status !== "Approved") await call(M, ids.recourse, "approve_merchant", { account_id: s });
}

// 6b. Keep each demo seller's prepaid storage topped up (sponsored by the master account).
for (const s of ids.shops) {
  const m = await view(ids.recourse, "get_merchant", { account_id: s });
  if (BigInt(m.merchant.storage_balance) < near("0.15")) {
    await call(M, ids.recourse, "add_storage_for", { account_id: s }, "0.25");
  }
}

// 7. Demo catalogue: one listing per product, created by its maker.
const catalog = JSON.parse(fs.readFileSync("web/data/products.json", "utf8"));
const existing = await view(ids.recourse, "get_listings", { from_index: 0, limit: 100 });
const listed = new Set(existing.map((l) => l.listing.image));
for (const p of catalog.products) {
  const image = `/products/${p.slug}.jpg`;
  if (listed.has(image)) continue;
  await call(`${p.maker}.${M}`, ids.recourse, "create_listing", {
    title: p.title,
    description: p.description,
    image,
    price: String(BigInt(p.price) * USDC),
    claim_window_ms: catalog.claim_window_minutes * 60_000,
  });
}

// 8. Summary for Vercel env vars.
const summary = [
  "## Recourse testnet deployment",
  "",
  "| Role | Account |",
  "| --- | --- |",
  `| Contract | \`${ids.recourse}\` |`,
  `| Test USDC | \`${ids.token}\` |`,
  `| Judge | \`${ids.judge}\` |`,
  `| Relayer | \`${ids.relayer}\` |`,
  `| Sellers | ${ids.shops.map((s) => `\`${s}\``).join(", ")} |`,
  `| Demo buyers | ${ids.buyers.map((b) => `\`${b}\``).join(", ")} |`,
  "",
  `Windows: response/appeal ${WINDOW_MS / 60000} min, review ${REVIEW_MS / 60000} min.`,
].join("\n");
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + "\n");
