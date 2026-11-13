import Link from "next/link";
import { view, MASTER } from "@/lib/chain";
import { makers, products, productForImage, type MakerKey } from "@/lib/catalog";
import { usdc, pct, tierWords, recordLine } from "@/lib/format";
import type { ListingView, MerchantView } from "@/lib/types";
import { ProductImage } from "@/components/ProductImage";
import { Seal } from "@/components/Seal";

export const dynamic = "force-dynamic";

export default async function Home() {
  let listings: ListingView[] = [];
  let merchants: Record<string, MerchantView | null> = {};
  let failed = false;
  try {
    listings = (await view<ListingView[]>("get_listings", { from_index: 0, limit: 100 })).filter(
      (l) => l.listing.active
    );
    const keys = Object.keys(makers) as MakerKey[];
    const views = await Promise.all(
      keys.map((k) => view<MerchantView | null>("get_merchant", { account_id: `${k}.${MASTER}` }))
    );
    merchants = Object.fromEntries(keys.map((k, i) => [k, views[i]]));
  } catch {
    failed = true;
  }

  const featured = products.find((p) => p.slug === "indigo-throw")!;
  const featuredListing = listings.find((l) => productForImage(l.listing.image)?.slug === featured.slug);

  return (
    <>
      <section className="spread">
        <div>
          <ProductImage slug={featured.slug} tone={featured.tone} alt={featured.title} className="spread-image" eager />
          <p className="caption">
            {featured.title} by {makers.loomhouse.name}, woven in {makers.loomhouse.place}.
          </p>
        </div>
        <div className="spread-text">
          <h1>Things made by hand, paid for with a receipt that has your back.</h1>
          <p className="spread-lead">
            Every order here comes with a receipt that holds part of your payment until the order is right.
          </p>
          <ol className="steps">
            <li>You pay the price in USDC. Nothing extra.</li>
            <li>Part goes to the maker now. The rest is held in your receipt.</li>
            <li>When the claim window closes, the maker gets the rest. If something is wrong, you claim it back.</li>
          </ol>
          <p className="protect-line">
            <Seal />
            Sell the item on, and the protection goes with the receipt.
          </p>
          {featuredListing && (
            <Link className="button" href={`/product/${featuredListing.id}`} style={{ justifySelf: "start" }}>
              See the {featured.title.toLowerCase()}
            </Link>
          )}
        </div>
      </section>

      <section className="makers" aria-label="Makers">
        {(Object.keys(makers) as MakerKey[]).map((k) => {
          const m = makers[k];
          const v = merchants[k];
          return (
            <article className="maker" key={k}>
              <h3>{m.name}</h3>
              <p className="muted small">{m.place}</p>
              <p>{m.craft}</p>
              {v && (
                <p className="maker-record">
                  {tierWords[v.tier]}. {recordLine(v.merchant.finished, v.merchant.lost)}.
                </p>
              )}
            </article>
          );
        })}
      </section>

      <section aria-labelledby="objects-title">
        <div className="objects-head">
          <h2 id="objects-title">The collection</h2>
          <p className="muted small">{listings.length} pieces from three makers</p>
        </div>
        {failed && (
          <p className="notice">The shop couldn't reach NEAR testnet just now. Refresh in a moment.</p>
        )}
        <div className="objects">
          {listings.map((l) => {
            const p = productForImage(l.listing.image);
            if (!p) return null;
            return (
              <Link className="object" href={`/product/${l.id}`} key={l.id}>
                <ProductImage slug={p.slug} tone={p.tone} alt={p.title} />
                <div className="object-meta">
                  <span className="object-title">{p.title}</span>
                  <span className="object-price">{usdc(l.listing.price)} USDC</span>
                </div>
                <span className="muted small">{l.merchant_name}</span>
                <span className="protect-line">
                  <Seal size={15} />
                  {pct(l.lock_bps)} held for you until the order is right
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}
