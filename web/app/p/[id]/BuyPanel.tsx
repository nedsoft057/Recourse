"use client";

import Link from "next/link";
import { useState } from "react";
import { tourEmit } from "@/lib/tour";
import { Seal } from "@/components/Seal";

const fmt = (raw: string) => {
  const n = Number(raw) / 1_000_000;
  return n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
};

export function BuyPanel(props: {
  listingId: number;
  maker: string;
  price: string;
  sellerNow: string;
  held: string;
  lockBps: number;
  windowText: string;
  buyerName: string | null;
}) {
  const [state, setState] = useState<"idle" | "paying" | "done">("idle");
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<{ token_id: string; hash: string } | null>(null);
  const heldPct = props.lockBps / 100;

  async function pay() {
    setState("paying");
    setError("");
    const res = await fetch("/api/buy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listing_id: props.listingId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Payment didn't go through.");
      setState("idle");
      return;
    }
    setReceipt(data);
    setState("done");
    tourEmit("buy", { token: String(data.token_id) });
  }

  if (state === "done" && receipt) {
    return (
      <section className="stub" aria-live="polite">
        <div className="stub-head">
          <Seal size={20} />
          Paid. Receipt #{receipt.token_id} is yours
        </div>
        <p>
          {fmt(props.sellerNow)} USDC went to {props.maker}. {fmt(props.held)} USDC is held in your receipt for the next{" "}
          {props.windowText}.
        </p>
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          <Link className="button" href="/purchases">See your receipt</Link>
          <a className="button ghost" href={`https://testnet.nearblocks.io/txns/${receipt.hash}`} target="_blank" rel="noreferrer">
            View transaction
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="stub" aria-label="Your protection">
      <div className="stub-head">
        <Seal size={20} />
        Protected purchase
      </div>
      <div className="split-bar" aria-hidden="true">
        <span className="now" style={{ width: `${100 - heldPct}%` }} />
        <span className="held" style={{ width: `${heldPct}%` }} />
      </div>
      <div className="stub-rows">
        <div className="stub-row"><span>To {props.maker} now</span><span>{fmt(props.sellerNow)} USDC</span></div>
        <div className="stub-row held"><span>Held for you, {props.windowText}</span><span>{fmt(props.held)} USDC</span></div>
        <div className="stub-row total"><span>You pay</span><span>{fmt(props.price)} USDC</span></div>
      </div>
      {props.buyerName ? (
        <button className="button full" onClick={pay} disabled={state === "paying"}>
          {state === "paying" ? "Paying…" : `Pay ${fmt(props.price)} USDC as ${props.buyerName}`}
        </button>
      ) : (
        <p className="notice">You're viewing as a seller. Switch to Ada or Bayo at the top to pay.</p>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  );
}
