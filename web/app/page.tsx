import Link from "next/link";
import { Seal } from "@/components/Seal";
import { Landscape } from "@/components/Landscape";

export default function Landing() {
  return (
    <>
      <section className="sky-hero">
        <div className="sky-hero-text">
          <span className="trust-chip">
            <span className="trust-dots" aria-hidden="true"><i /><i /><i /></span>
            Live on NEAR testnet, with an AI dispute judge
          </span>
          <h1>
            <span>Crypto payments,</span>
            <span className="blue">now with a chargeback.</span>
          </h1>
          <p className="sub">
            Make a protected payment link for anything you sell on WhatsApp, Instagram or face to face. Part of the
            payment reaches you now; the rest is held in your buyer's receipt until the order is right.
          </p>
          <div className="hero-actions">
            <Link className="button" href="/new">Create a protected link</Link>
            <Link className="button quiet" href="/p/1">Try a sample checkout</Link>
          </div>
        </div>
        <Landscape />
      </section>

      <div className="wrap">
        <section className="section" aria-labelledby="how">
          <div className="section-head">
            <h2 id="how">How a protected payment works</h2>
            <p className="muted">No escrow agent, no platform holding your money. A NEAR contract follows the rules for both sides.</p>
          </div>
          <ol className="steps">
            <li className="card">
              <h3>You make a link</h3>
              <p className="muted">Item, price, how long the buyer can claim. Share it anywhere, or show the QR code in person.</p>
            </li>
            <li className="card">
              <h3>Your buyer pays</h3>
              <p className="muted">In USDC on NEAR. They get a receipt, an NFT that holds part of the payment until the window closes.</p>
            </li>
            <li className="card">
              <h3>The window closes</h3>
              <p className="muted">No claim, and the held part comes to you. If the order went wrong, the buyer claims it back.</p>
            </li>
          </ol>
        </section>

        <section className="section split-section" aria-label="What makes it different">
          <div className="dark-card">
            <Seal size={28} on="light" />
            <h3>Protection that travels with the item</h3>
            <p>
              The receipt is an NFT the buyer holds. Sell the item on, pass the receipt with it, and the new owner keeps
              whatever protection is left. Card chargebacks can't do that.
            </p>
          </div>
          <div className="card" style={{ padding: "1.6rem", display: "grid", gap: "0.9rem", alignContent: "start" }}>
            <h3 style={{ fontSize: "1.8rem", lineHeight: 1.05 }}>A seller record that pays off</h3>
            <p className="muted">The share held for the buyer depends on the seller's history, worked out on-chain.</p>
            <table className="tiers">
              <thead>
                <tr><th scope="col">Seller</th><th scope="col">Record</th><th scope="col" className="num">Held</th></tr>
              </thead>
              <tbody>
                <tr><td>New</td><td className="muted">Under 5 completed orders</td><td className="num">50%</td></tr>
                <tr><td>Established</td><td className="muted">5 or more</td><td className="num">30%</td></tr>
                <tr><td>Trusted</td><td className="muted">20+, under 5% lost claims</td><td className="num">15%</td></tr>
                <tr><td>Under review</td><td className="muted">3+ lost claims, 20% or more</td><td className="num">100%</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="section" aria-labelledby="disputes" style={{ paddingBottom: "4rem" }}>
          <div className="section-head">
            <h2 id="disputes">When something goes wrong</h2>
            <p className="muted">
              The buyer opens a claim, the seller answers, and an AI judge running in a secure enclave rules on the
              evidence. Money stays locked while either side can appeal, and a person reviews anything the AI can't decide.
            </p>
          </div>
          <Link className="button dark" href="/new">Create your first link</Link>
        </section>
      </div>
    </>
  );
}
