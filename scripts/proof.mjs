// Screenshots the real proof for the README: NearBlocks pages for the exact
// transactions in docs/evidence.json, and the live app's pages for those receipts.
import { chromium } from "playwright";
import fs from "node:fs";

const SITE = "https://recourse-market.vercel.app";
const NB = "https://testnet.nearblocks.io";
const C = "pay.favour-recourse.testnet";
const ev = JSON.parse(fs.readFileSync("docs/evidence.json", "utf8"));
const step = (scen, re) => ev.scenarios.find((s) => s.name === scen).steps.find((x) => re.test(x.step));
const tok = (scen) => ev.scenarios.find((s) => s.name === scen).steps.find((x) => x.token).token;
const OUT = "docs/images/proof";
fs.mkdirSync(OUT, { recursive: true });
const shots = [];

const browser = await chromium.launch();

async function explorer(name, hash, caption) {
  const url = `https://testnet.near.rocks/tx/${hash}`;
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1 });
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.getByText("Receipts", { exact: false }).first().waitFor({ timeout: 45000 });
    await page.waitForTimeout(5000);
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.screenshot({ path: `${OUT}/${name}.jpg`, type: "jpeg", quality: 85, fullPage: true, clip: { x: 60, y: 60, width: 1160, height: Math.min(1500, h - 60) } });
    shots.push({ name, url, nearblocks: `${NB}/txns/${hash}`, caption, ok: true });
    console.log("ok", name);
  } catch (e) {
    shots.push({ name, url, caption, ok: false, error: e.message.slice(0, 160) });
    console.log("FAILED", name, e.message.slice(0, 160));
  }
  await page.close();
}

async function app(name, path, as, caption, { from = 0, height = 2200 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  try {
    await page.request.post(`${SITE}/api/identity`, { data: { as } });
    await page.goto(SITE + path, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(3500);
    const total = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.screenshot({ path: `${OUT}/${name}.jpg`, type: "jpeg", quality: 82, fullPage: true, clip: { x: 0, y: from, width: 390, height: Math.min(height, total - from) } });
    shots.push({ name, url: SITE + path, caption, ok: true });
    console.log("ok", name);
  } catch (e) {
    shots.push({ name, url: SITE + path, caption, ok: false, error: e.message.slice(0, 160) });
    console.log("FAILED", name, e.message.slice(0, 160));
  }
  await ctx.close();
}

const t38 = tok("Resale + damaged item");
const transfer = step("Resale + damaged item", /nft_transfer/).hash;
const ruling = step("Resale + damaged item", /^AI ruling/).hash;
const resolve = step("Appeal to a human", /resolve_review/).hash;
const dflt = step("Silent seller", /default_judgment/).hash;
const collect = step("Clean sale", /release_many/).hash;
const extend = step("Late parcel", /extend_window/).hash;

const purchase = step("Resale + damaged item", /ft_transfer_call/).hash;
const withdraw = step("Resale + damaged item", /withdraw/).hash;
await explorer("tx-purchase", purchase, `ft_transfer_call: Ada pays 8 USDC; the contract splits it and mints receipt NFT #${t38} (nft_mint event)`);
await explorer("tx-transfer", transfer, `nft_transfer: Ada passes receipt #${t38}, and the protection, to Bayo`);
await explorer("tx-ruling", ruling, "post_ruling from judge.favour-recourse.testnet: the AI ruling with its hash, chat ID and enclave signing address");
await explorer("tx-withdraw", withdraw, "withdraw: Bayo, the new owner, takes out the refund in USDC");
await explorer("tx-resolve", resolve, "resolve_review: the human reviewer's final 50/50 decision on an appeal");
await explorer("tx-default", dflt, "default_judgment: the seller never answered, so the holder was refunded");
await explorer("tx-collect", collect, "release_many: no claim, the window closed, the seller collected");
await explorer("tx-extend", extend, "extend_window: the buyer pushed the claim window back once");

await app("case-resale", `/case/${t38}`, "buyer-b", `Case #${t38}: Bayo's claim with a photo, the AI ruling, and Verify this ruling`);
await app("case-appeal", `/case/${tok("Appeal to a human")}`, "reviewer", `Case #${tok("Appeal to a human")}: the seller's appeal with a file, decided by the reviewer`);
await app("case-false", `/case/${tok("False claim")}`, "atelier", `Case #${tok("False claim")}: a false claim loses to proof of delivery`);
await app("case-silent", `/case/${tok("Silent seller")}`, "buyer-b", `Case #${tok("Silent seller")}: the seller stayed silent and the holder was refunded`);
await app("purchases-extended", `/purchases`, "buyer-a", "Ada's purchases: a receipt extended once, with View NFT", { height: 1700 });

fs.writeFileSync(`${OUT}/shots.json`, JSON.stringify(shots, null, 2));
await browser.close();
