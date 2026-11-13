import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { view } from "@/lib/chain";
import { usdc, minutes } from "@/lib/format";
import type { ListingView } from "@/lib/types";
import { ShareTools } from "./ShareTools";

export const dynamic = "force-dynamic";

export default async function LinkReady({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listingId = Number(id);
  if (!Number.isInteger(listingId) || listingId < 0) notFound();
  const link = await view<ListingView | null>("get_listing", { listing_id: listingId });
  if (!link) notFound();

  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "recourse-market.vercel.app";
  const proto = h.get("x-forwarded-proto") || "https";
  const url = `${proto}://${host}/p/${link.id}`;
  const qr = await QRCode.toString(url, { type: "svg", margin: 0, color: { dark: "#2B2F36", light: "#FFFFFF" } });
  const windowText = minutes(link.listing.claim_window_ms);

  return (
    <>
      <section className="hero ready-hero">
        <svg className="big-seal" width="84" height="84" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="10.5" fill="none" stroke="#1A73E8" strokeWidth="0.9" strokeDasharray="1.6 1.3" />
          <circle cx="12" cy="12" r="7.6" fill="#1A73E8" />
          <path d="M8.4 12.2l2.4 2.4 4.8-5" fill="none" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <h1>Your link is ready</h1>
        <p className="sub">
          {link.listing.title}, {usdc(link.listing.price)} USDC, {windowText} of protection
        </p>
      </section>

      <div className="narrow ready-body">
        <ShareTools url={url} title={link.listing.title} price={usdc(link.listing.price)} />

        <div className="dark-card qr-card">
          <div className="qr" role="img" aria-label={`QR code for ${url}`} dangerouslySetInnerHTML={{ __html: qr }} />
          <div style={{ display: "grid", gap: "0.3rem" }}>
            <h3 style={{ fontSize: "1.35rem" }}>Selling face to face?</h3>
            <p className="small">Your buyer scans this and pays with protection.</p>
          </div>
        </div>

        <section className="card" style={{ padding: "1rem", display: "grid", gap: "0.8rem" }} aria-label="How you get paid">
          <span className="label">How you get paid</span>
          <div className="payout">
            <span className="dot" />
            <div style={{ display: "grid" }}>
              <strong>When the buyer pays</strong>
              <span className="small muted">Straight to your balance</span>
            </div>
            <span className="amount">{usdc(link.seller_now)} USDC</span>
            <span className="dot glow" />
            <div style={{ display: "grid" }}>
              <strong>When the {windowText} close</strong>
              <span className="small muted">If there's no claim</span>
            </div>
            <span className="amount c">{usdc(link.protected)} USDC</span>
          </div>
        </section>

        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", justifyContent: "center" }}>
          <Link className="button quiet" href={`/p/${link.id}`}>Preview the checkout</Link>
          <Link className="button quiet" href="/sell">Open your seller desk</Link>
        </div>
      </div>
    </>
  );
}
