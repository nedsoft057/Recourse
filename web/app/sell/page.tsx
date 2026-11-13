import Link from "next/link";
import { view } from "@/lib/chain";
import { accountOf, currentPerson, personByAccount } from "@/lib/identity";
import { usdc, pct, tierWords, recordLine } from "@/lib/format";
import type { ListingView, MerchantView, ReceiptView } from "@/lib/types";
import { When } from "@/components/When";
import { Thumb } from "@/components/Thumb";
import { WithdrawButton } from "../purchases/ReceiptActions";
import { CollectButton } from "./CollectButton";

export const dynamic = "force-dynamic";

const sellerStatus: Record<string, string> = {
  Locked: "Held for the buyer",
  Disputed: "Claim open",
  Ruled: "Ruled, in appeal window",
  UnderReview: "With a reviewer",
  Appealed: "Appealed",
  Settled: "Paid in full",
  Refunded: "Refunded to buyer",
  Split: "Split decision",
};

export default async function SellerDesk() {
  const me = await currentPerson();
  if (me.role !== "seller") {
    return (
      <div className="wrap">
        <div className="desk-head"><h1>Seller desk</h1></div>
        <div className="empty">
          <p className="muted">
            You're viewing as {me.name}. Switch to Atelier Ama, Loom House or Field Kit Supply at the top to
            see a seller's links, orders and payouts.
          </p>
        </div>
      </div>
    );
  }
  const account = accountOf(me.key);
  const [merchant, receipts, balance, allLinks] = await Promise.all([
    view<MerchantView | null>("get_merchant", { account_id: account }),
    view<ReceiptView[]>("get_merchant_receipts", { account_id: account, limit: 50 }),
    view<string>("get_balance", { account_id: account }),
    view<ListingView[]>("get_listings", { from_index: 0, limit: 100 }),
  ]);
  const links = allLinks.filter((l) => l.listing.merchant === account).reverse();
  const now = Date.now();
  const matured = receipts
    .filter((r) => r.escrow.status === "Locked" && now >= r.escrow.claim_ends)
    .map((r) => r.token_id);
  const heldTotal = receipts
    .filter((r) => !["Settled", "Refunded", "Split"].includes(r.escrow.status))
    .reduce((sum, r) => sum + Number(r.escrow.locked), 0);

  return (
    <div className="wrap">
      <div className="desk-head" style={{ gridTemplateColumns: "1fr auto", alignItems: "end" }}>
        <div style={{ display: "grid", gap: "0.5rem" }}>
          <h1>{me.name}</h1>
          {merchant && (
            <p className="muted">
              {tierWords[merchant.tier]}. {recordLine(merchant.merchant.finished, merchant.merchant.lost)}. On new
              payments, {pct(merchant.lock_bps)} is held for the buyer until the claim window closes.
            </p>
          )}
        </div>
        <Link className="button" href="/new">New link</Link>
      </div>

      <div className="card balance-bar">
        <div>
          <p className="label">Ready to withdraw</p>
          <p className="balance-amount">{usdc(balance)} USDC</p>
        </div>
        <div>
          <p className="label">Still held for buyers</p>
          <p className="balance-amount" style={{ color: "var(--c-2)" }}>{usdc(heldTotal)} USDC</p>
        </div>
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          <CollectButton tokenIds={matured} />
          <WithdrawButton disabled={balance === "0"} />
        </div>
      </div>

      <h2 style={{ fontSize: "1.8rem", marginBottom: "0.75rem" }}>Your links</h2>
      {links.length === 0 ? (
        <p className="muted" style={{ marginBottom: "2rem" }}>No links yet.</p>
      ) : (
        <div className="links">
          {links.map((l) => (
            <Link className="card link-card" href={`/p/${l.id}/ready`} key={l.id}>
              <Thumb image={l.listing.image} title={l.listing.title} />
              <span>
                <strong>{l.listing.title}</strong>
                <span className="small muted">
                  {usdc(l.listing.price)} USDC, {l.listing.sold} paid
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}

      <h2 style={{ fontSize: "1.8rem", marginBottom: "0.75rem" }}>Payments</h2>
      {receipts.length === 0 ? (
        <p className="muted" style={{ paddingBottom: "4rem" }}>No payments yet. Share a link to get your first one.</p>
      ) : (
        <div className="card table-card">
          <table className="orders">
            <thead>
              <tr>
                <th scope="col">Receipt</th>
                <th scope="col">Item</th>
                <th scope="col">Held by</th>
                <th scope="col" className="num">Price</th>
                <th scope="col" className="num">Held</th>
                <th scope="col">Status</th>
                <th scope="col">Window closes</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((r) => (
                <tr key={r.token_id}>
                  <td><Link href={`/case/${r.token_id}`}>#{r.token_id}</Link></td>
                  <td>{r.listing_title}</td>
                  <td>{personByAccount(r.holder)?.name || r.holder}</td>
                  <td className="num">{usdc(r.escrow.price)}</td>
                  <td className="num">{usdc(r.escrow.locked)}</td>
                  <td>{r.escrow.status === "Disputed" && !r.escrow.claim?.responded_at ? <Link href={`/case/${r.token_id}`}>Claim open: respond</Link> : sellerStatus[r.escrow.status]}</td>
                  <td><When ms={r.escrow.claim_ends} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
