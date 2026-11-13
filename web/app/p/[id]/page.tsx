import { notFound } from "next/navigation";
import { view } from "@/lib/chain";
import { tierWords, recordLine, minutes } from "@/lib/format";
import { currentPerson } from "@/lib/identity";
import type { ListingView, MerchantView } from "@/lib/types";
import { Thumb } from "@/components/Thumb";
import { BuyPanel } from "./BuyPanel";

export const dynamic = "force-dynamic";

export default async function Checkout({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listingId = Number(id);
  if (!Number.isInteger(listingId) || listingId < 0) notFound();
  const link = await view<ListingView | null>("get_listing", { listing_id: listingId });
  if (!link) notFound();
  const merchant = await view<MerchantView | null>("get_merchant", { account_id: link.listing.merchant });
  const me = await currentPerson();
  const l = link.listing;

  return (
    <div className="checkout">
      <div className="checkout-photo">
        <Thumb image={l.image} title={l.title} eager />
        <div className="checkout-photo-text">
          <span>Sold by {link.merchant_name}</span>
          <h1>{l.title}</h1>
        </div>
      </div>
      <div className="checkout-body">
        <div className="checkout-row">
          {merchant && (
            <span className="chip light">
              <b />
              {tierWords[merchant.tier]}. {recordLine(merchant.merchant.finished, merchant.merchant.lost)}
            </span>
          )}
          <span className="price-big">
            {(Number(l.price) / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 })} <small>USDC</small>
          </span>
        </div>
        <p className="description">{l.description}</p>

        {l.active ? (
          <BuyPanel
            listingId={link.id}
            maker={link.merchant_name}
            price={l.price}
            sellerNow={link.seller_now}
            held={link.protected}
            lockBps={link.lock_bps}
            windowText={minutes(l.claim_window_ms)}
            buyerName={me.role === "buyer" ? me.name : null}
          />
        ) : (
          <p className="notice">The seller has paused this link.</p>
        )}

        <div className="tiles">
          <div className="tile">
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#0AAFD6" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg>
            Not right? Claim the held part back
          </div>
          <div className="tile">
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#0AAFD6" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h13M13 6l6 6-6 6" /></svg>
            Resell it, and the protection goes too
          </div>
          <div className="tile">
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#0AAFD6" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3z" /></svg>
            Paid on NEAR testnet in test USDC
          </div>
        </div>
      </div>
    </div>
  );
}
