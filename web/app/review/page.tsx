import Link from "next/link";
import { view, MASTER } from "@/lib/chain";
import { currentPerson, PEOPLE, accountOf, personByAccount } from "@/lib/identity";
import { usdc } from "@/lib/format";
import type { ReceiptView } from "@/lib/types";
import { When } from "@/components/When";

export const dynamic = "force-dynamic";

export default async function ReviewQueue() {
  const me = await currentPerson();
  if (me.role !== "reviewer") {
    return (
      <div className="wrap">
        <div className="desk-head"><h1>Review queue</h1></div>
        <p className="muted empty">Switch to Reviewer at the top to see cases waiting for a human decision.</p>
      </div>
    );
  }
  const sellers = PEOPLE.filter((p) => p.role === "seller");
  const lists = await Promise.all(
    sellers.map((s) => view<ReceiptView[]>("get_merchant_receipts", { account_id: accountOf(s.key), limit: 100 }))
  );
  const all = lists.flat();
  const waiting = all
    .filter((r) => r.escrow.status === "UnderReview" || r.escrow.status === "Appealed")
    .sort((a, b) => (a.escrow.review?.deadline ?? 0) - (b.escrow.review?.deadline ?? 0));
  const open = all.filter((r) => r.escrow.status === "Disputed" || r.escrow.status === "Ruled");

  return (
    <div className="wrap">
      <div className="desk-head">
        <h1>Review queue</h1>
        <p className="muted">
          Cases the AI judge couldn't decide, and appeals. Your decision is final and is recorded on-chain from the owner
          account ({MASTER}).
        </p>
      </div>
      {waiting.length === 0 ? (
        <p className="notice" style={{ marginBottom: "2rem" }}>Nothing waiting for a human decision.</p>
      ) : (
        <div className="card table-card">
          <table className="orders">
            <thead>
              <tr><th>Receipt</th><th>Item</th><th>Why it's here</th><th className="num">Held</th><th>Decide by</th></tr>
            </thead>
            <tbody>
              {waiting.map((r) => (
                <tr key={r.token_id}>
                  <td><Link href={`/case/${r.token_id}`}>#{r.token_id}</Link></td>
                  <td>{r.listing_title}</td>
                  <td>{r.escrow.status === "Appealed" ? `Appeal: ${r.escrow.review?.reason}` : r.escrow.review?.reason}</td>
                  <td className="num">{usdc(r.escrow.locked)}</td>
                  <td>{r.escrow.review && <When ms={r.escrow.review.deadline} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <h2 style={{ fontSize: "1.6rem", marginBottom: "0.75rem" }}>Other open disputes</h2>
      {open.length === 0 ? (
        <p className="muted" style={{ paddingBottom: "4rem" }}>None.</p>
      ) : (
        <ul style={{ paddingBottom: "4rem" }}>
          {open.map((r) => (
            <li key={r.token_id}>
              <Link href={`/case/${r.token_id}`}>#{r.token_id} {r.listing_title}</Link>{" "}
              <span className="muted small">
                {r.escrow.status === "Ruled" ? "ruled, in appeal window" : "claim open"}, held by {personByAccount(r.holder)?.name}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
