import { view } from "@/lib/chain";
import { accountOf, currentPerson, personByAccount } from "@/lib/identity";
import { usdc, pct, tierWords, recordLine } from "@/lib/format";
import type { MerchantView, ReceiptView } from "@/lib/types";
import { When } from "@/components/When";
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
      <div className="empty">
        <h1 style={{ fontSize: "var(--t-h2)" }}>Seller desk</h1>
        <p className="muted">
          You're viewing as {me.name}, a buyer. Switch to Atelier Ama, Loom House or Field Kit Supply at the top to
          see a seller's orders and payouts.
        </p>
      </div>
    );
  }
  const account = accountOf(me.key);
  const [merchant, receipts, balance] = await Promise.all([
    view<MerchantView | null>("get_merchant", { account_id: account }),
    view<ReceiptView[]>("get_merchant_receipts", { account_id: account, limit: 50 }),
    view<string>("get_balance", { account_id: account }),
  ]);
  const now = Date.now();
  const matured = receipts
    .filter((r) => r.escrow.status === "Locked" && now >= r.escrow.claim_ends)
    .map((r) => r.token_id);
  const heldTotal = receipts
    .filter((r) => !["Settled", "Refunded", "Split"].includes(r.escrow.status))
    .reduce((sum, r) => sum + Number(r.escrow.locked), 0);

  return (
    <>
      <div className="page-head">
        <h1 style={{ fontSize: "var(--t-h2)" }}>{me.name}</h1>
        {merchant && (
          <p className="muted">
            {tierWords[merchant.tier]}. {recordLine(merchant.merchant.finished, merchant.merchant.lost)}. On new
            orders, {pct(merchant.lock_bps)} is held for the buyer until the claim window closes.
          </p>
        )}
      </div>

      <div className="balance-bar">
        <div>
          <p className="muted small">Ready to withdraw</p>
          <p className="balance-amount">{usdc(balance)} USDC</p>
        </div>
        <div>
          <p className="muted small">Still held for buyers</p>
          <p className="balance-amount">{usdc(heldTotal)} USDC</p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <CollectButton tokenIds={matured} />
          <WithdrawButton disabled={balance === "0"} />
        </div>
      </div>

      {receipts.length === 0 ? (
        <div className="empty">
          <p>No orders yet.</p>
        </div>
      ) : (
        <table className="orders">
          <thead>
            <tr>
              <th scope="col">Order</th>
              <th scope="col">Item</th>
              <th scope="col">Buyer</th>
              <th scope="col" className="num">Price</th>
              <th scope="col" className="num">Held</th>
              <th scope="col">Status</th>
              <th scope="col">Window closes</th>
            </tr>
          </thead>
          <tbody>
            {receipts.map((r) => (
              <tr key={r.token_id}>
                <td>#{r.token_id}</td>
                <td>{r.listing_title}</td>
                <td>{personByAccount(r.holder)?.name || r.holder}</td>
                <td className="num">{usdc(r.escrow.price)}</td>
                <td className="num">{usdc(r.escrow.locked)}</td>
                <td>{sellerStatus[r.escrow.status]}</td>
                <td><When ms={r.escrow.claim_ends} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
