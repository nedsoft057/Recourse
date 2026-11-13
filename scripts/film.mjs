// Films the live site at a human pace for the launch video.
// Each scenario is its own browser context, so each becomes its own clip.
// Run in GitHub Actions: node scripts/film.mjs  →  film/<name>.webm + film/meta.json
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const SITE = process.env.SITE || "https://recourse-market.vercel.app";
const OUT = "film";
const VIEW = { width: 390, height: 844 };
fs.mkdirSync(OUT, { recursive: true });
const meta = {};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = (a, b) => a + Math.random() * (b - a);

// A visible finger/cursor dot, since headless browsers draw none.
const CURSOR = `
  addEventListener('DOMContentLoaded', () => {
    const d = document.createElement('div');
    d.id = '__finger';
    Object.assign(d.style, {position:'fixed',left:'-40px',top:'-40px',width:'26px',height:'26px',margin:'-13px 0 0 -13px',
      borderRadius:'50%',background:'rgba(20,24,32,.28)',border:'2px solid rgba(255,255,255,.9)',boxShadow:'0 2px 8px rgba(0,0,0,.25)',
      zIndex:2147483647,pointerEvents:'none',transition:'transform .12s ease, background .12s ease'});
    document.body.appendChild(d);
    addEventListener('mousemove', e => { d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px'; }, true);
    addEventListener('mousedown', () => { d.style.transform = 'scale(.75)'; d.style.background = 'rgba(26,115,232,.45)'; }, true);
    addEventListener('mouseup', () => { d.style.transform = 'scale(1)'; d.style.background = 'rgba(20,24,32,.28)'; }, true);
  });`;

const ONLY = (process.env.ONLY || "").split(",").map((s) => s.trim()).filter(Boolean);

async function clip(name, fn) {
  if (ONLY.length && !ONLY.some((o) => name.startsWith(o))) return true;
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 2 });
  await context.addInitScript(CURSOR);
  const page = await context.newPage();
  // Record at full device resolution through the DevTools screencast
  // (Playwright's own recorder captures at CSS size only).
  const dir = path.join(OUT, name);
  fs.mkdirSync(dir, { recursive: true });
  const frames = [];
  const cdp = await context.newCDPSession(page);
  cdp.on("Page.screencastFrame", async (f) => {
    const file = path.join(dir, `f${String(frames.length).padStart(5, "0")}.jpg`);
    fs.writeFileSync(file, Buffer.from(f.data, "base64"));
    frames.push({ file, ts: f.metadata.timestamp });
    cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 780, maxHeight: 1688, everyNthFrame: 1 });
  const started = Date.now();
  const marks = [];
  const mark = (label) => marks.push({ label, t: (Date.now() - started) / 1000 });
  let ok = true;
  try {
    await fn(page, mark);
  } catch (e) {
    ok = false;
    console.error(`[${name}] failed:`, e.message);
    await page.screenshot({ path: `${OUT}/${name}-error.jpg`, type: "jpeg", quality: 80 }).catch(() => {});
  }
  await sleep(1000);
  const end = Date.now() / 1000;
  await cdp.send("Page.stopScreencast").catch(() => {});
  await context.close();
  await browser.close();
  // Frames arrive only when the page repaints: hold each until the next one.
  const t0 = started / 1000;
  let list = "";
  frames.forEach((f, i) => {
    const next = i + 1 < frames.length ? frames[i + 1].ts : end;
    const d = Math.max(0.001, next - Math.max(f.ts, i === 0 ? t0 : f.ts));
    list += `file '${path.resolve(f.file)}'\nduration ${d.toFixed(4)}\n`;
  });
  if (frames.length) list += `file '${path.resolve(frames[frames.length - 1].file)}'\n`;
  fs.writeFileSync(path.join(dir, "list.txt"), list);
  // Pad the start so clip time 0 lines up with the marks.
  const lead = frames.length ? Math.max(0, frames[0].ts - t0) : 0;
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", path.join(dir, "list.txt"),
    "-vf", `tpad=start_duration=${lead.toFixed(3)}:start_mode=clone,fps=30,scale=780:1688:force_original_aspect_ratio=decrease,pad=780:1688:0:0:white,format=yuv420p`,
    "-c:v", "libx264", "-crf", "18", "-preset", "veryfast", "-movflags", "+faststart", path.join(OUT, `${name}.mp4`)]);
  fs.rmSync(dir, { recursive: true, force: true });
  meta[name] = { ok, marks };
  console.log(`[${name}] ${ok ? "ok" : "FAILED"} frames=${frames.length}`, JSON.stringify(marks));
  return ok;
}

// ---- human-ish input -------------------------------------------------------

let pos = { x: 195, y: 600 };
async function moveTo(page, loc) {
  await loc.scrollIntoViewIfNeeded();
  await sleep(jitter(150, 300));
  const b = await loc.boundingBox();
  if (!b) throw new Error("element not visible");
  const x = b.x + b.width * jitter(0.35, 0.65);
  const y = b.y + b.height * jitter(0.4, 0.6);
  const steps = 18;
  for (let i = 1; i <= steps; i++) {
    const k = i / steps;
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    await page.mouse.move(pos.x + (x - pos.x) * e, pos.y + (y - pos.y) * e);
    await sleep(14);
  }
  pos = { x, y };
}
async function press(page, loc) {
  await moveTo(page, loc);
  await sleep(jitter(150, 280));
  await loc.click();
}
async function typeHuman(page, loc, text, { typos = true } = {}) {
  await press(page, loc);
  await loc.fill("");
  const neighbours = "qwertyuiopasdfghjklzxcvbnm";
  let i = 0;
  for (const ch of text) {
    i++;
    if (typos && /[a-z]/.test(ch) && i > 6 && Math.random() < 0.025) {
      await page.keyboard.type(neighbours[Math.floor(Math.random() * neighbours.length)]);
      await sleep(jitter(160, 320));
      await page.keyboard.press("Backspace");
      await sleep(jitter(90, 160));
    }
    await page.keyboard.type(ch);
    let d = jitter(45, 120);
    if (ch === " ") d += jitter(20, 70);
    if (/[.,]/.test(ch)) d += jitter(150, 350);
    await sleep(d);
  }
  await sleep(jitter(250, 500));
}
async function scrollBy(page, dy, ms = 900) {
  const steps = Math.max(8, Math.round(ms / 30));
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, dy / steps);
    await sleep(ms / steps);
  }
}
async function settle(page, ms = 600) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await sleep(ms);
}

async function api(page, url, body) {
  const r = await page.request.post(`${SITE}${url}`, { data: body });
  const j = await r.json();
  if (!r.ok()) throw new Error(`${url}: ${j.error}`);
  return j;
}
async function setAs(page, key) {
  await api(page, "/api/identity", { as: key });
}

// Set-up work that isn't filmed: a fresh link and a purchase, done over the API.
async function freshPurchase(page, { title, price, description, buyer }) {
  await setAs(page, "atelier");
  const link = await api(page, "/api/links", { title, description, price, image: null, claim_window_ms: 300000 });
  await setAs(page, buyer);
  const buy = await api(page, "/api/buy", { listing_id: Number(link.id) });
  return { listing: link.id, token: buy.token_id };
}

// ---- scenarios -------------------------------------------------------------

const shared = {};
const T0 = Date.now();

// Set up the scenarios that need time to pass: a clean sale whose window will
// close, and a claim the seller will ignore.
{
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(SITE);
  if (!ONLY.length || ONLY.some((o) => "13-collect".startsWith(o))) {
    shared.collect = await freshPurchase(page, { title: "Card wallet", price: "15", description: "Slim hand-stitched leather card wallet.", buyer: "buyer-a" });
  }
  if (!ONLY.length || ONLY.some((o) => "14-silent".startsWith(o))) {
    shared.silent = await freshPurchase(page, { title: "Aso-oke cushion cover", price: "18", description: "Hand-woven aso-oke cushion cover, 45 cm.", buyer: "buyer-b" });
    await api(page, "/api/dispute", { action: "open_claim", token_id: shared.silent.token, reason: "not_delivered", statement: "Two weeks and nothing has arrived. The seller stopped replying.", photo: null });
  }
  await browser.close();
  console.log("setup", JSON.stringify(shared));
}

await clip("01-landing", async (page, mark) => {
  await page.goto(SITE);
  await settle(page, 1500);
  mark("hero");
  await sleep(1500);
  await scrollBy(page, 700, 2200);
  mark("statement");
  await sleep(1200);
  await scrollBy(page, 900, 2500);
  mark("features");
  await sleep(1500);
});

await clip("02-create", async (page, mark) => {
  await page.goto(SITE);
  await settle(page, 600);
  await setAs(page, "atelier");
  await page.reload();
  await settle(page, 800);
  mark("start");
  await press(page, page.getByRole("link", { name: "Create a link" }).first());
  await settle(page, 800);
  mark("form");
  await typeHuman(page, page.getByLabel("What are you selling?"), "Leather market tote");
  await typeHuman(page, page.getByPlaceholder("120"), "20", { typos: false });
  await typeHuman(page, page.getByLabel("Short description"), "Honey-brown leather tote, two riveted handles. New, unused.");
  await press(page, page.getByRole("button", { name: "5 min" }));
  await sleep(500);
  mark("submit");
  await press(page, page.locator('form button[type="submit"]'));
  await page.waitForURL(/\/p\/\d+\/ready/, { timeout: 30000 });
  shared.listing = page.url().match(/\/p\/(\d+)/)[1];
  await settle(page, 1200);
  mark("ready");
  await sleep(1200);
  await scrollBy(page, 500, 1500);
  await sleep(1200);
});

await clip("03-buy", async (page, mark) => {
  await page.goto(`${SITE}/p/${shared.listing}`);
  await settle(page, 600);
  await setAs(page, "buyer-a");
  await page.reload();
  await settle(page, 1200);
  mark("checkout");
  await sleep(1200);
  await scrollBy(page, 420, 1400);
  mark("split");
  await sleep(1800);
  const pay = page.getByRole("button", { name: /^Pay / });
  mark("pay");
  await press(page, pay);
  await page.getByText(/Paid\. Receipt #/).waitFor({ timeout: 45000 });
  shared.token = (await page.getByText(/Paid\. Receipt #/).textContent()).match(/#(\d+)/)[1];
  mark("paid");
  await sleep(2500);
});

await clip("04-resale", async (page, mark) => {
  await page.goto(`${SITE}/purchases`);
  await settle(page, 400);
  await setAs(page, "buyer-a");
  await page.reload();
  await settle(page, 1200);
  mark("receipt");
  await sleep(1800);
  const card = page.locator("article.receipt").first();
  const sel = card.locator("select");
  await moveTo(page, sel);
  await sleep(400);
  await sel.selectOption("buyer-b");
  await sleep(600);
  mark("pass");
  await press(page, card.getByRole("button", { name: "Pass on receipt" }));
  await page.getByText(/The protection went with it/).waitFor({ timeout: 30000 });
  mark("passed");
  await sleep(2200);
});

await clip("05-claim", async (page, mark) => {
  await page.goto(`${SITE}/purchases`);
  await settle(page, 400);
  await setAs(page, "buyer-b");
  await page.reload();
  await settle(page, 1200);
  mark("bayo");
  await sleep(1200);
  await press(page, page.locator("article.receipt").first().getByRole("link", { name: /Claim/ }));
  await settle(page, 1000);
  mark("form");
  const reason = page.getByLabel("What went wrong");
  await moveTo(page, reason);
  await reason.selectOption("damaged");
  await sleep(500);
  await typeHuman(page, page.getByLabel("What happened"), "Arrived Tuesday with the left handle torn off its rivet. The rivet was loose in the bag.");
  mark("submit");
  await press(page, page.getByRole("button", { name: /^Claim .* back$/ }));
  await page.getByText(/Respond|seller|responds/i).first().waitFor({ timeout: 30000 });
  await settle(page, 1500);
  mark("claimed");
  await sleep(1800);
});

async function respondAndRule(page, mark, token, text, photo) {
  await page.goto(`${SITE}/case/${token}`);
  await settle(page, 400);
  await setAs(page, "atelier");
  await page.reload();
  await settle(page, 1200);
  mark("case");
  await sleep(1200);
  await typeHuman(page, page.getByLabel("What happened"), text);
  if (photo) await typeHuman(page, page.getByLabel(/Photo link/), photo, { typos: false });
  mark("send");
  await press(page, page.getByRole("button", { name: "Send response" }));
  mark("judging");
  const notice = page.locator(".notice").first();
  await notice.waitFor({ timeout: 120000 });
  const outcome = (await notice.textContent()) || "";
  await settle(page, 1500);
  mark("ruled");
  await sleep(1500);
  const verify = page.getByText("Verify this ruling");
  if (await verify.count()) {
    await verify.scrollIntoViewIfNeeded();
    await scrollBy(page, -120, 600);
    mark("verify");
    await sleep(3500);
  }
  console.log("outcome:", outcome);
  return /^Ruled/.test(outcome.trim());
}

await clip("06-respond", async (page, mark) => {
  shared.ruled1 = await respondAndRule(
    page,
    mark,
    shared.token,
    "I shipped it in perfect condition. I think it was damaged in transit. I don't have a photo of the handles before dispatch."
  );
});

// The seller appeals the AI ruling; a human reviewer decides.
await clip("10-appeal", async (page, mark) => {
  await page.goto(`${SITE}/case/${shared.token}`);
  await settle(page, 400);
  await setAs(page, "atelier");
  await page.reload();
  await settle(page, 1200);
  mark("appeal");
  await typeHuman(page, page.getByLabel("Why the ruling is wrong"), "The courier signed for it undamaged. I want a person to look at this.");
  await press(page, page.getByRole("button", { name: "Send to a human reviewer" }));
  await page.locator(".notice, .error").first().waitFor({ timeout: 30000 }).catch(() => {});
  await settle(page, 1500);
  mark("appealed");
  await sleep(1200);
  await setAs(page, "reviewer");
  await page.goto(`${SITE}/review`);
  await settle(page, 1500);
  mark("queue");
  await sleep(1500);
  await press(page, page.getByRole("link", { name: new RegExp(`#${shared.token}`) }).first());
  await settle(page, 1500);
  mark("decide");
  await press(page, page.getByRole("button", { name: "Split 50/50" }));
  await typeHuman(page, page.getByLabel(/Your reasoning/), "The handle failed at the rivet, likely in transit. Neither side can prove when. Splitting the held amount.");
  await press(page, page.getByRole("button", { name: "Record final decision" }));
  await page.getByText(/Split|split/).first().waitFor({ timeout: 30000 });
  await settle(page, 1800);
  mark("decided");
  await sleep(2500);
});

// The lying buyer: claims it never arrived; the seller shows proof of delivery.
await clip("07-lie", async (page, mark) => {
  await page.goto(SITE);
  const p = await freshPurchase(page, {
    title: "Enamel camp mug",
    price: "8",
    description: "White enamel camp mug with navy rim, 350 ml.",
    buyer: "buyer-a",
  });
  shared.lie = p.token;
  await page.goto(`${SITE}/case/${p.token}`);
  await settle(page, 1200);
  mark("claim");
  await typeHuman(page, page.getByLabel("What happened"), "It never came. Nothing was delivered.");
  await press(page, page.getByRole("button", { name: /^Claim .* back$/ }));
  await page.getByText(/Respond|seller|responds/i).first().waitFor({ timeout: 30000 });
  await settle(page, 800);
  shared.ruled2 = await respondAndRule(
    page,
    mark,
    p.token,
    "Delivered Tuesday 10:42 by GIG Logistics, tracking GIG-482-117, status Delivered. The buyer messaged me 'got it, thanks' that afternoon.",
    "https://recourse-market.vercel.app/products/enamel-mug.jpg"
  );
});

await clip("08-extend", async (page, mark) => {
  await page.goto(SITE);
  await freshPurchase(page, {
    title: "Natural belt",
    price: "12",
    description: "Undyed vegetable-tanned leather belt, brass buckle.",
    buyer: "buyer-a",
  });
  await page.goto(`${SITE}/purchases`);
  await settle(page, 1500);
  mark("receipt");
  await sleep(1500);
  await press(page, page.locator("article.receipt").first().getByRole("button", { name: /Extend window/ }));
  await page.getByText(/extended once|Claim window extended/).first().waitFor({ timeout: 30000 });
  mark("extended");
  await sleep(2500);
});

await clip("09-demo", async (page, mark) => {
  await page.goto(SITE);
  await settle(page, 1500);
  mark("landing");
  await press(page, page.getByRole("button", { name: "Try the 2-minute demo" }).first());
  await page.waitForURL(/\/new/, { timeout: 20000 });
  await settle(page, 1500);
  mark("guide");
  await sleep(3500);
});

async function waitUntil(sec) {
  const left = T0 + sec * 1000 - Date.now();
  if (left > 0) { console.log(`waiting ${Math.round(left / 1000)}s for a window to close`); await sleep(left); }
}

// The seller never answered: after the deadline, anyone can refund the holder.
await clip("14-silent", async (page, mark) => {
  await waitUntil(200);
  await page.goto(`${SITE}/case/${shared.silent.token}`);
  await settle(page, 400);
  await setAs(page, "buyer-b");
  await page.reload();
  await settle(page, 1500);
  mark("case");
  await sleep(2000);
  await press(page, page.getByRole("button", { name: /Refund .* to the receipt holder/ }));
  await page.getByText(/Refunded|refunded/).first().waitFor({ timeout: 30000 });
  await settle(page, 1500);
  mark("refunded");
  await sleep(2500);
});

// A clean sale: no claim, the window closes, the seller collects.
await clip("13-collect", async (page, mark) => {
  await waitUntil(340);
  await page.goto(`${SITE}/sell`);
  await settle(page, 400);
  await setAs(page, "atelier");
  await page.reload();
  await settle(page, 1500);
  mark("desk");
  await sleep(2000);
  await press(page, page.getByRole("button", { name: /Collect/ }).first());
  await page.waitForFunction(() => !/Collecting/.test(document.body.innerText), null, { timeout: 30000 });
  await settle(page, 2000);
  mark("collected");
  await sleep(1500);
  await scrollBy(page, -400, 800);
  await sleep(1500);
});

meta.shared = shared;
fs.writeFileSync(`${OUT}/meta-${ONLY.join("_") || "all"}.json`, JSON.stringify(meta, null, 2));
console.log(JSON.stringify(shared));
