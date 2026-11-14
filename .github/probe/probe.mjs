import { chromium } from "playwright";
const urls = {
  pikespeak_tx: "https://testnet.pikespeak.ai/transaction-viewer/HPBRCWGjyBzyVJPBC4vK9s18LpYWKAYrXsFPpJu7cum9",
  pikespeak_acct: "https://testnet.pikespeak.ai/wallet-explorer/pay.favour-recourse.testnet",
  nearblocks_cf: "https://testnet.nearblocks.io/txns/HPBRCWGjyBzyVJPBC4vK9s18LpYWKAYrXsFPpJu7cum9",
  legacy_explorer: "https://explorer.testnet.near.org/transactions/HPBRCWGjyBzyVJPBC4vK9s18LpYWKAYrXsFPpJu7cum9",
  nearscope: "https://nearscope.net/testnet/txns/HPBRCWGjyBzyVJPBC4vK9s18LpYWKAYrXsFPpJu7cum9",
  fastnear: "https://explorer.testnet.fastnear.com/tx/HPBRCWGjyBzyVJPBC4vK9s18LpYWKAYrXsFPpJu7cum9",
};
const b = await chromium.launch();
for (const [n,u] of Object.entries(urls)) {
  const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  try { await p.goto(u, { waitUntil: "domcontentloaded", timeout: 40000 }); await p.waitForTimeout(12000); } catch(e) { console.log(n, "ERR", e.message.slice(0,80)); }
  await p.screenshot({ path: "probe/"+n+".jpg", type: "jpeg", quality: 60 }).catch(()=>{});
  console.log(n, p.url(), (await p.title().catch(()=>"")).slice(0,80));
  await p.close();
}
await b.close();
