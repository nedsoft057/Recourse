import { view } from "@/lib/chain";
import { accountOf, currentPerson } from "@/lib/identity";
import type { MerchantView } from "@/lib/types";
import { tierWords } from "@/lib/format";
import { CreateForm } from "./CreateForm";

export const dynamic = "force-dynamic";

export default async function NewLink() {
  const me = await currentPerson();
  const merchant =
    me.role === "seller"
      ? await view<MerchantView | null>("get_merchant", { account_id: accountOf(me.key) })
      : null;

  return (
    <>
      <section className="hero page-hero">
        <div className="page-hero-inner">
          {me.role === "seller" && <span className="chip" style={{ justifySelf: "start" }}><b />{me.name}</span>}
          <h1>New protected link</h1>
          <p className="sub">Sell anywhere. Your buyer pays with part of it held for them until the order is right.</p>
        </div>
      </section>
      <div className="narrow lift" style={{ paddingBottom: "3rem" }}>
        {merchant ? (
          <CreateForm
            sellerName={me.name}
            lockBps={merchant.lock_bps}
            tier={tierWords[merchant.tier]}
          />
        ) : (
          <div className="card create-card">
            <p>
              You're viewing as {me.name}, a buyer. Switch to Atelier Ama, Loom House or Field Kit Supply at the top to
              create a link as a seller.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
