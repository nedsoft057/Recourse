// Checks the photo-reading judge: one claim with a photo, then prints what the vision model saw.
// node scripts/vision-check.mjs
import fs from "node:fs";

const SITE = process.env.SITE || "https://recourse-market.vercel.app";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T0 = Date.now();
const out = { site: SITE, contract: "pay.favour-recourse.testnet", token: "usdc.favour-recourse.testnet", ran_at: new Date().toISOString(), scenarios: [] };

let cookie = "";
async function call(path, body, { form } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(SITE + path, {
        method: "POST",
        headers: form ? { cookie } : { "Content-Type": "application/json", cookie },
        body: form || JSON.stringify(body),
      });
      const set = res.headers.get("set-cookie");
      if (set) cookie = set.split(";")[0];
      const j = await res.json();
      if (!res.ok || j.error) throw new Error(`${path}: ${j.error || res.status}`);
      return j;
    } catch (e) {
      if (attempt >= 3 || /: [A-Z]/.test(e.message)) throw e;
      await sleep(3000);
    }
  }
}
const as = (who) => call("/api/identity", { as: who });
async function link(seller, title, price, description) {
  await as(seller);
  const l = await call("/api/links", { title, description, price, image: null, claim_window_ms: 300000 });
  return l;
}
async function buy(buyer, listing) {
  await as(buyer);
  for (let i = 0; ; i++) {
    await sleep(2500);
    try { return await call("/api/buy", { listing_id: Number(listing) }); }
    catch (e) { if (i >= 5 || !/for sale/.test(e.message)) throw e; }
  }
}
async function upload(name, type, bytes) {
  const form = new FormData();
  form.append("file", new Blob([bytes], { type }), name);
  return (await call("/api/upload", null, { form })).file;
}
const waitUntil = async (sec) => { const left = T0 + sec * 1000 - Date.now(); if (left > 0) { console.log(`waiting ${Math.round(left / 1000)}s`); await sleep(left); } };
function scenario(name, what) {
  const s = { name, what, steps: [] };
  out.scenarios.push(s);
  return (step, r, extra = {}) => { s.steps.push({ step, hash: r?.hash || null, ...extra }); console.log(`[${name}] ${step}`, r?.hash || "", JSON.stringify(extra)); };
}

const photo = fs.readFileSync(process.env.PHOTO || "web/public/products/market-tote.jpg");
const s = scenario("Photo check", "Buyer claims damage with a photo; the vision model describes it for the judge.");
const l = await link("fieldkit", "Vision check: leather tote", "8", "Honey-brown leather tote, two riveted handles. New.");
const b = await buy("buyer-a", l.id);
s("bought", b, { token: b.token_id });
const f = await upload("tote-on-arrival.jpg", "image/jpeg", photo);
s("open_claim with photo", await call("/api/dispute", { action: "open_claim", token_id: b.token_id, reason: "damaged", statement: "Arrived with the left handle torn off its rivet. Photo attached.", photo: null, files: [f] }));
await as("fieldkit");
await sleep(3000);
const r = await call("/api/dispute", { action: "respond", token_id: b.token_id, statement: "I shipped it in perfect condition, as the buyer's own photo shows.", photo: null });
s(`judge: ${r.judged?.outcome || "none"}`, r.judged);
await sleep(4000);
const q = await fetch("https://test.rpc.fastnear.com", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "query", params: { request_type: "call_function", finality: "optimistic", account_id: "pay.favour-recourse.testnet", method_name: "get_receipt", args_base64: Buffer.from(JSON.stringify({ token_id: b.token_id })).toString("base64") } }) }).then((x) => x.json());
const rec = JSON.parse(Buffer.from(q.result.result).toString());
console.log("STATUS", rec.escrow.status);
console.log("RULING", JSON.stringify(rec.escrow.ruling, null, 1));
console.log("REVIEW", JSON.stringify(rec.escrow.review));
