// Runs every Recourse scenario against the live site and records the real
// testnet transactions, so the README can link each claim to its proof.
// node scripts/evidence.mjs  →  docs/evidence.json
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

// 1. Clean sale: no claim, the window closes, the seller collects and withdraws.
const s1 = scenario("Clean sale", "Buyer pays, nobody claims, the seller collects the held part after the window and withdraws.");
const l1 = await link("loomhouse", "Evidence: card wallet", "6", "Slim leather card wallet.");
s1("create_listing (Loom House)", l1, { listing: l1.id });
const b1 = await buy("buyer-a", l1.id);
s1("ft_transfer_call → receipt NFT minted to Ada", b1, { token: b1.token_id });

// 2. Resale, damaged on arrival, AI refund to the new holder.
const s2 = scenario("Resale + damaged item", "Ada buys and passes the receipt to Bayo; Bayo claims with a photo; the AI judge refunds the current holder.");
const l2 = await link("fieldkit", "Evidence: leather tote", "8", "Honey-brown leather tote, two riveted handles. New.");
s2("create_listing (Field Kit)", l2, { listing: l2.id });
const b2 = await buy("buyer-a", l2.id);
s2("ft_transfer_call → receipt NFT minted to Ada", b2, { token: b2.token_id });
await as("buyer-a");
s2("nft_transfer → receipt passed to Bayo", await call("/api/act", { action: "pass_on", token_id: b2.token_id, to: "buyer-b" }));
await as("buyer-b");
const f2 = await upload("torn-handle.jpg", "image/jpeg", photo);
s2("upload evidence photo (encrypted, Vercel Blob)", null, { sha256: f2.sha256 });
s2("open_claim (Bayo, with photo)", await call("/api/dispute", { action: "open_claim", token_id: b2.token_id, reason: "damaged", statement: "Arrived with the left handle torn off its rivet. Photo attached.", photo: null, files: [f2] }));
await as("fieldkit");
await sleep(3000);
const r2 = await call("/api/dispute", { action: "respond", token_id: b2.token_id, statement: "I shipped it in perfect condition. I have no photo of the handles before dispatch.", photo: null });
s2("respond (seller) → AI judge on NEAR AI Cloud", r2);
s2(`AI ruling: ${r2.judged?.outcome || "none"}`, r2.judged);

// 3. Appeal: the seller appeals the ruling; the human reviewer splits.
const s3 = scenario("Appeal to a human", "The seller appeals an AI ruling with a file; the reviewer decides a 50/50 split.");
const l3 = await link("fieldkit", "Evidence: field jacket", "10", "Waxed canvas field jacket, size M.");
s3("create_listing (Field Kit)", l3, { listing: l3.id });
const b3 = await buy("buyer-b", l3.id);
s3("ft_transfer_call → receipt NFT minted to Bayo", b3, { token: b3.token_id });
s3("open_claim (Bayo)", await call("/api/dispute", { action: "open_claim", token_id: b3.token_id, reason: "not_as_described", statement: "The jacket is size S, not M as described.", photo: null }));
await as("fieldkit");
await sleep(3000);
const r3 = await call("/api/dispute", { action: "respond", token_id: b3.token_id, statement: "It was labelled M when it left. Sizes run small.", photo: null });
s3("respond (seller) → AI judge", r3);
s3(`AI ruling: ${r3.judged?.outcome || "none"}`, r3.judged);
let appealed = false;
if (/^Ruled/.test(r3.judged?.outcome || "")) {
  const f3 = await upload("label.jpg", "image/jpeg", photo);
  s3("appeal (seller, with a file)", await call("/api/dispute", { action: "appeal", token_id: b3.token_id, reason: "The label photo shows size M. Please review.", files: [f3] }));
  appealed = true;
}
await as("reviewer");
try {
  s3("resolve_review (human reviewer: 50/50)", await call("/api/dispute", { action: "resolve", token_id: b3.token_id, buyer_bps: 5000, note: "Size labels conflict; neither side can prove the size at dispatch. Splitting." }), { appealed });
} catch (e) { s3("resolve_review skipped", null, { note: e.message.slice(0, 160) }); }

// 4. False claim: proof of delivery wins.
const s4 = scenario("False claim", "The buyer says it never came; the seller shows tracking; the AI releases the money to the seller.");
const l4 = await link("atelier", "Evidence: enamel mug", "5", "White enamel camp mug, 350 ml.");
s4("create_listing (Atelier Ama)", l4, { listing: l4.id });
const b4 = await buy("buyer-a", l4.id);
s4("ft_transfer_call → receipt NFT minted to Ada", b4, { token: b4.token_id });
s4("open_claim (Ada: never arrived)", await call("/api/dispute", { action: "open_claim", token_id: b4.token_id, reason: "not_delivered", statement: "It never came. Nothing was delivered.", photo: null }));
await as("atelier");
await sleep(3000);
const r4 = await call("/api/dispute", { action: "respond", token_id: b4.token_id, statement: "Delivered Tuesday 10:42 by GIG Logistics, tracking GIG-482-117, status Delivered, signed by the buyer. She messaged 'got it, thanks' that afternoon.", photo: null });
s4("respond (seller, with tracking) → AI judge", r4);
s4(`AI ruling: ${r4.judged?.outcome || "none"}`, r4.judged);

// 5. Silent seller.
const s5 = scenario("Silent seller", "The seller never answers; after the response deadline the holder is refunded.");
const l5 = await link("atelier", "Evidence: cushion cover", "5", "Aso-oke cushion cover, 45 cm.");
s5("create_listing (Atelier Ama)", l5, { listing: l5.id });
const b5 = await buy("buyer-b", l5.id);
s5("ft_transfer_call → receipt NFT minted to Bayo", b5, { token: b5.token_id });
s5("open_claim (Bayo)", await call("/api/dispute", { action: "open_claim", token_id: b5.token_id, reason: "not_delivered", statement: "Two weeks and nothing arrived; the seller stopped replying.", photo: null }));
const claimAt = Date.now();

// 6. Late parcel: extend once.
const s6 = scenario("Late parcel", "The holder extends the claim window once.");
const l6 = await link("loomhouse", "Evidence: leather belt", "5", "Undyed leather belt, brass buckle.");
s6("create_listing (Loom House)", l6, { listing: l6.id });
const b6 = await buy("buyer-a", l6.id);
s6("ft_transfer_call → receipt NFT minted to Ada", b6, { token: b6.token_id });
s6("extend_window (Ada)", await call("/api/act", { action: "extend", token_id: b6.token_id }));

// Waits: appeal windows (3 min), response deadline (3 min), claim window (5 min).
const wait = (ms) => sleep(Math.max(0, ms));
await wait(claimAt + 200_000 - Date.now());
await as("buyer-b");
s5("default_judgment → refund to holder", await call("/api/dispute", { action: "default_judgment", token_id: b5.token_id }));
await as("buyer-a");
for (const [s, tok] of [[s2, b2.token_id], [s4, b4.token_id]]) {
  try { s("finalize (after the appeal window)", await call("/api/dispute", { action: "finalize", token_id: tok })); }
  catch (e) { s("finalize skipped", null, { note: e.message.slice(0, 120) }); }
}
await waitUntil(345);
await as("loomhouse");
s1("release_many (seller collects after the window)", await call("/api/act", { action: "release_many", token_ids: [b1.token_id] }));
s1("withdraw (seller)", await call("/api/act", { action: "withdraw" }));
await as("buyer-b");
try { s2("withdraw (Bayo, the refund)", await call("/api/act", { action: "withdraw" })); } catch (e) { s2("withdraw skipped", null, { note: e.message.slice(0, 120) }); }

fs.mkdirSync("docs", { recursive: true });
fs.writeFileSync("docs/evidence.json", JSON.stringify(out, null, 2));
console.log("done");
