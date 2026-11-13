import Link from "next/link";
import { view } from "@/lib/chain";
import { accountOf, currentPerson, PEOPLE, personByAccount } from "@/lib/identity";
import { productForImage } from "@/lib/catalog";
import { usdc } from "@/lib/format";
import { statusFor } from "@/lib/status";
import type { ReceiptView, ListingView } from "@/lib/types";
import { ProductImage } from "@/components/ProductImage";
import { When, Countdown } from "@/components/When";
import { Seal } from "@/components/Seal";
import { ReceiptActions, WithdrawButton } from "./ReceiptActions";

export const dynamic = "force-dynamic";

export default async function Purchases() {
  const me = await currentPerson();
  if (me.role !== "buyer") {
    return (
      <div className="empty">
        <h1 style={{ fontSize: "var(--t-h2)" }}>Purchases</h1>
        <p className="muted">You're viewing as {me.name}, a seller. Switch to Ada or Bayo at the top to see a buyer's receipts.</p>
      </div>
    );
  }

  const account = accountOf(me.key);
  const tokens = await view<{ token_id: string }[]>("nft_tokens_for_owner", { account_id: account, limit: 50 });
  const receipts = (
    await Promise.all(tokens.map((t) => view<ReceiptView | null>("get_receipt", { token_id: t.token_id })))
  )
    .filter((r): r is ReceiptView => !!r)
    .sort((a, b) => b.escrow.paid_at - a.escrow.paid_at);
  const listings = await Promise.all(
    [...new Set(receipts.map((r) => r.escrow.listing_id))].map((id) =>
      view<ListingView | null>("get_listing", { listing_id: id })
    )
  );
  const imageFor = (id: number) => listings.find((l) => l?.id === id)?.listing.image;
  const balance = await view<string>("get_balance", { account_id: account });
  const others = PEOPLE.filter((p) => p.role === "buyer" && p.key !== me.key).map((p) => ({ key: p.key, name: p.name }));
  const now = Date.now();

  return (
    <>
      <div className="page-head">
        <h1 style={{ fontSize: "var(--t-h2)" }}>{me.name}'s purchases</h1>
        <p className="muted">
          Each receipt holds part of what you paid until its claim window closes. Refunds land in your balance below.
        </p>
      </div>

      <div className="balance-bar">
        <div>
          <p className="muted small">Ready to withdraw</p>
          <p className="balance-amount">{usdc(balance)} USDC</p>
        </div>
        <WithdrawButton disabled={balance === "0"} />
      </div>

      {receipts.length === 0 ? (
        <div className="empty">
          <p>No purchases yet.</p>
          <Link className="button" href="/">Browse the collection</Link>
        </div>
      ) : (
        <div className="receipts">
          {receipts.map((r) => {
            const e = r.escrow;
            const p = productForImage(imageFor(e.listing_id));
            const s = statusFor(e, now);
            const boughtBy = personByAccount(e.original_buyer);
            const resold = e.original_buyer !== account;
            return (
              <article className="receipt" key={r.token_id}>
                {p ? <ProductImage slug={p.slug} tone={p.tone} alt={p.title} /> : <div />}
                <div className="receipt-body">
                  <h3 style={{ fontSize: "1.25rem" }}>{r.listing_title}</h3>
                  <p className={`receipt-status ${s.held ? "held" : ""}`}>
                    {s.held && <Seal size={15} />} {s.title}
                  </p>
                  <ul className="timeline">
                    <li>
                      Receipt #{r.token_id}, paid {usdc(e.price)} USDC on <When ms={e.paid_at} />
                      {resold && boughtBy ? `, passed on by ${boughtBy.name}` : ""}
                    </li>
                    {e.status === "Locked" && now < e.claim_ends && (
                      <li>
                        Claim window closes <When ms={e.claim_ends} /> (<Countdown ms={e.claim_ends} />)
                      </li>
                    )}
                    {e.closed_at && (
                      <li>
                        Closed <When ms={e.closed_at} />
                      </li>
                    )}
                  </ul>
                </div>
                <ReceiptActions
                  tokenId={r.token_id}
                  status={e.status}
                  claimOpen={e.status === "Locked" && now < e.claim_ends}
                  others={others}
                />
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
