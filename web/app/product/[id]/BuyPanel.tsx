"use client";

import Link from "next/link";
import { useState } from "react";
import { Seal } from "@/components/Seal";

const fmt = (raw: string) => {
  const n = Number(raw) / 1_000_000;
  return n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
};

export function BuyPanel(props: {
  listingId: number;
  title: string;
  maker: string;
  price: string;
  sellerNow: string;
  held: string;
  lockBps: number;
  tier: string;
  windowText: string;
  buyerName: string | null;
}) {
  const [state, setState] = useState<"idle" | "paying" | "done">("idle");
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<{ token_id: string; hash: string } | null>(null);
  const heldPct = props.lockBps / 100;

  async function buy() {
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
  }

  if (state === "done" && receipt) {
    return (
      <section className="stub" aria-live="polite">
        <div className="stub-head">
          <Seal />
          Receipt #{receipt.token_id} is yours
        </div>
        <p>
          {fmt(props.sellerNow)} USDC went to {props.maker}. {fmt(props.held)} USDC is held in your receipt for the
          next {props.windowText}.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <Link className="button" href="/purchases">Go to your purchases</Link>
          <a
            className="button quiet"
            href={`https://testnet.nearblocks.io/txns/${receipt.hash}`}
            target="_blank"
            rel="noreferrer"
          >
            View the transaction
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="stub" aria-label="Your protection">
      <div className="stub-head">
        <Seal />
        Protected purchase
      </div>
      <div className="split-bar" aria-hidden="true">
        <span className="now" style={{ width: `${100 - heldPct}%` }} />
        <span className="held" style={{ width: `${heldPct}%` }} />
      </div>
      <div className="stub-rows">
        <div className="stub-row">
          <span>Paid to {props.maker} now</span>
          <span>{fmt(props.sellerNow)} USDC</span>
        </div>
        <div className="stub-row held">
          <span>Held for you for {props.windowText}</span>
          <span>{fmt(props.held)} USDC</span>
        </div>
        <div className="stub-row total">
          <span>You pay</span>
          <span>{fmt(props.price)} USDC</span>
        </div>
      </div>
      <ul className="stub-notes">
        <li>If it doesn't arrive or isn't as described, claim the held amount back.</li>
        <li>Sell it on, and the protection goes to the new owner with the receipt.</li>
        <li>
          {props.tier}, so {heldPct}% is held. Sellers with a clean record have less held.
        </li>
      </ul>
      {props.buyerName ? (
        <button className="button full" onClick={buy} disabled={state === "paying"}>
          {state === "paying" ? "Paying…" : `Buy as ${props.buyerName} for ${fmt(props.price)} USDC`}
        </button>
      ) : (
        <p className="notice">You're viewing as a seller. Switch to Ada or Bayo at the top to buy.</p>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  );
}
