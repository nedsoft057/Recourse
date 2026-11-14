import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 1100 } });
await p.goto("https://explorer.testnet.near.org/transactions/HPBRCWGjyBzyVJPBC4vK9s18LpYWKAYrXsFPpJu7cum9", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(4000);
await p.getByText("Near Rocks").click();
await p.waitForTimeout(15000);
console.log("rocks tx url", p.url());
await p.screenshot({ path: "probe/rocks_tx.jpg", type: "jpeg", quality: 70 });
const base = new URL(p.url()).origin;
for (const [n, path] of [["rocks_acct", "/accounts/pay.favour-recourse.testnet"], ["rocks_nft", "/nft/pay.favour-recourse.testnet/38"], ["rocks_nft2", "/tokens/pay.favour-recourse.testnet"]]) {
  await p.goto(base + path, { waitUntil: "domcontentloaded" }).catch(()=>{});
  await p.waitForTimeout(12000);
  console.log(n, p.url(), await p.title());
  await p.screenshot({ path: "probe/" + n + ".jpg", type: "jpeg", quality: 70 });
}
await b.close();
