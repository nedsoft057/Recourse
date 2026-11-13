import Link from "next/link";
import { notFound } from "next/navigation";
import { view } from "@/lib/chain";
import { makers, productForImage, makerKeyFromAccount } from "@/lib/catalog";
import { usdc, tierWords, recordLine, minutes } from "@/lib/format";
import { currentPerson } from "@/lib/identity";
import type { ListingView, MerchantView } from "@/lib/types";
import { ProductImage } from "@/components/ProductImage";
import { BuyPanel } from "./BuyPanel";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listingId = Number(id);
  if (!Number.isInteger(listingId) || listingId < 0) notFound();

  const listing = await view<ListingView | null>("get_listing", { listing_id: listingId });
  if (!listing) notFound();
  const product = productForImage(listing.listing.image);
  if (!product) notFound();
  const merchant = await view<MerchantView | null>("get_merchant", { account_id: listing.listing.merchant });
  const makerKey = makerKeyFromAccount(listing.listing.merchant);
  const maker = makerKey ? makers[makerKey] : undefined;
  const me = await currentPerson();

  return (
    <article className="product">
      <ProductImage slug={product.slug} tone={product.tone} alt={product.title} className="product-photo" eager />
      <div className="product-info">
        <div style={{ display: "grid", gap: "0.6rem" }}>
          <Link href="/" className="product-maker">{listing.merchant_name}</Link>
          <h1 style={{ fontSize: "var(--t-h2)" }}>{product.title}</h1>
          <p className="product-price">{usdc(listing.listing.price)} USDC</p>
        </div>
        <p>{product.description}</p>
        <ul className="details">
          {product.details.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>

        {merchant && (
          <div className="seller-record">
            <strong>{tierWords[merchant.tier]}</strong>
            <span className="muted small">
              {recordLine(merchant.merchant.finished, merchant.merchant.lost)}.
              {maker ? ` ${maker.craft}` : ""}
            </span>
          </div>
        )}

        <BuyPanel
          listingId={listing.id}
          title={product.title}
          maker={listing.merchant_name}
          price={listing.listing.price}
          sellerNow={listing.seller_now}
          held={listing.protected}
          lockBps={listing.lock_bps}
          tier={tierWords[listing.tier]}
          windowText={minutes(listing.listing.claim_window_ms)}
          buyerName={me.role === "buyer" ? me.name : null}
        />
      </div>
    </article>
  );
}
