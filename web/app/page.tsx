import Link from "next/link";
import { StartDemo } from "@/components/StartDemo";
import { Seal } from "@/components/Seal";

function Icon({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
const I = {
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  pass: "M4 12h13M13 6l6 6-6 6",
  scale: "M12 3v18M5 7h14M7 7l-3 6a3 3 0 0 0 6 0zM17 7l-3 6a3 3 0 0 0 6 0z",
  star: "M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z",
  lock: "M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3",
  chat: "M4 20l1.3-4A8 8 0 1 1 8.5 19z",
};

const faqs = [
  {
    q: "Is this just escrow?",
    a: "Underneath, yes: part of the buyer's own payment is held by a NEAR contract, and the seller deposits nothing. What escrow doesn't give you is protection that moves with the item when it's resold, a seller record that sets how much is held, and a full dispute process with appeals.",
  },
  {
    q: "Who decides a dispute?",
    a: "An AI judge running on NEAR AI Cloud, inside a secure enclave, reads both sides' evidence and rules against a written policy. It runs every case twice; if the runs disagree, the evidence is inconclusive or the service is down, a person decides instead.",
  },
  {
    q: "Can the seller run off with the money?",
    a: "Not the held part. It sits in the contract until the claim window closes or a dispute is decided. Even after an AI ruling, the money stays locked through the appeal window.",
  },
  {
    q: "What happens if I resell the item?",
    a: "Pass the receipt to the new owner. Refunds always go to whoever holds the receipt, so the protection that's left goes with the item. Receipts can't be moved while a claim is open.",
  },
  {
    q: "Is it live?",
    a: "Yes, on NEAR testnet with test USDC. Every action in the app is a real testnet transaction you can check on NearBlocks. Use the picker at the top to try each role without a wallet.",
  },
];

export default function Landing() {
  return (
    <>
      <section className="cloud-hero">
        <div className="sky-objects" aria-hidden="true">
          <img className="obj o-bag" src="/sky/bag.webp" alt="" />
          <img className="obj o-shield" src="/sky/shield.webp" alt="" />
          <img className="obj o-parcel" src="/sky/parcel.webp" alt="" />
        </div>
        <div className="cloud-hero-text">
          <span className="glass-pill">Live on NEAR testnet, with an AI dispute judge</span>
          <h1>Crypto payments, now with a chargeback.</h1>
          <p>Make a protected payment link for anything you sell. Your buyer pays in USDC; part of it is held in their receipt until the order is right.</p>
          <div className="hero-actions">
            <StartDemo className="pill-btn dark" />
            <Link className="pill-btn white" href="/case/6">See a decided case</Link>
          </div>
        </div>

        <div className="stage">
          <div className="float-card f1">
            <span className="fc-icon"><Seal size={16} /></span>
            <span><b>Receipt #12 minted</b><small>60 USDC held for Ada</small></span>
          </div>
          <div className="float-card f2">
            <span className="fc-icon"><Icon d={I.pass} /></span>
            <span><b>Passed on to Bayo</b><small>Protection went with it</small></span>
          </div>
          <div className="float-card f3">
            <span className="fc-icon"><Icon d={I.scale} /></span>
            <span><b>AI judge: refund</b><small>Appeal window open, 2 days</small></span>
          </div>

          <div className="phone" role="img" aria-label="The Recourse checkout on a phone">
            <div className="phone-screen">
              <img className="ph-photo" src="/products/market-tote.jpg" alt="" />
              <div className="ph-body">
                <span className="ph-seller">Sold by Atelier Ama</span>
                <span className="ph-title">Market tote</span>
                <span className="ph-price">120 USDC</span>
                <div className="ph-stub">
                  <span className="ph-head"><Seal size={13} /> Protected purchase</span>
                  <span className="ph-bar"><i /><i /></span>
                  <span className="ph-row"><span>To seller now</span><span>60</span></span>
                  <span className="ph-row held"><span>Held for you, 7 days</span><span>60</span></span>
                </div>
                <span className="ph-pay">Pay 120 USDC</span>
              </div>
            </div>
          </div>
        </div>
        <div className="cloud-bank" aria-hidden="true" />
      </section>

      <section className="statement wrap">
        <p>
          <span className="dark">Imagine paying a stranger on Instagram </span>
          <span className="ic"><Icon d={I.chat} /></span>
          <span className="dark"> and still being covered. </span>
          A receipt that holds part of your money <span className="ic blue"><Icon d={I.lock} /></span>, an AI judge in a secure
          enclave <span className="ic"><Icon d={I.scale} /></span>, and protection that moves with the item when you sell it{" "}
          <span className="ic"><Icon d={I.pass} /></span>.
        </p>
      </section>

      <section className="features wrap" aria-label="Features">
        <article className="feature">
          <div className="feature-text">
            <span className="tag"><Icon d={I.link} /> Create</span>
            <h2>A protected link in under a minute</h2>
            <p>Item, price and how long the buyer can claim. Share it on WhatsApp or Instagram, or show the QR code face to face.</p>
          </div>
          <div className="feature-art tint-blue">
            <div className="mini-card">
              <span className="mini-label">What are you selling?</span>
              <span className="mini-input">Leather market tote</span>
              <span className="mini-label">Price</span>
              <span className="mini-input big">120 <small>USDC</small></span>
              <span className="mini-seg"><i>3 days</i><i className="on">7 days</i><i>14 days</i></span>
              <span className="mini-btn">Create protected link</span>
            </div>
          </div>
        </article>

        <article className="feature flip">
          <div className="feature-text">
            <span className="tag green"><Icon d={I.pass} /> Resell</span>
            <h2>Protection that travels with the item</h2>
            <p>The receipt is an NFT the buyer holds. Sell the item on, pass the receipt with it, and the new owner keeps whatever protection is left. Card chargebacks can't do that.</p>
          </div>
          <div className="feature-art tint-green">
            <div className="mini-card">
              <span className="mini-row"><img className="mini-thumb" src="/products/market-tote.jpg" alt="" /><span><b>Market tote</b><small>Receipt #12</small></span></span>
              <span className="mini-status"><Seal size={14} /> 60 USDC held, 5 days left</span>
              <span className="mini-label">Pass the receipt on to</span>
              <span className="mini-input">Bayo</span>
              <span className="mini-note">Passed on to Bayo. The protection went with it.</span>
            </div>
          </div>
        </article>

        <article className="feature">
          <div className="feature-text">
            <span className="tag rose"><Icon d={I.scale} /> Disputes</span>
            <h2>Disputes settled on evidence</h2>
            <p>The buyer claims, the seller answers, and an AI judge in a NEAR AI Cloud enclave rules. Money stays locked while either side can appeal, and a person decides anything the AI can't.</p>
          </div>
          <div className="feature-art tint-rose">
            <div className="mini-card">
              <span className="mini-label">The AI judge's ruling</span>
              <span className="mini-title">Refund the buyer in full</span>
              <span className="mini-li">Seller gave no proof the item left undamaged</span>
              <span className="mini-li">Buyer's photo shows the strap torn on arrival</span>
              <span className="mini-count">Money stays held: appeal window closes in 1 day 22 h</span>
            </div>
          </div>
        </article>

        <article className="feature flip">
          <div className="feature-text">
            <span className="tag amber"><Icon d={I.star} /> Reputation</span>
            <h2>A clean record pays off</h2>
            <p>How much of each payment is held depends on the seller's history, worked out on-chain. Good sellers get paid faster.</p>
          </div>
          <div className="feature-art tint-amber">
            <div className="mini-card">
              <span className="tier-row"><span>New</span><span className="muted">Under 5 orders</span><b>50%</b></span>
              <span className="tier-row"><span>Established</span><span className="muted">5 or more</span><b>30%</b></span>
              <span className="tier-row"><span>Trusted</span><span className="muted">20+, few lost claims</span><b>15%</b></span>
              <span className="tier-row"><span>Under review</span><span className="muted">Too many lost claims</span><b>100%</b></span>
            </div>
          </div>
        </article>
      </section>

      <section className="faq wrap" aria-labelledby="faq">
        <h2 id="faq">Frequently asked questions</h2>
        <div className="faq-list">
          {faqs.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="cta wrap">
        <h2>Sell to anyone. Protect everyone.</h2>
        <div className="hero-actions">
          <StartDemo className="pill-btn dark" />
          <Link className="pill-btn white" href="/new">Create your first link</Link>
        </div>
      </section>
    </>
  );
}
