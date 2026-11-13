"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DEMO_TEXT, readTour, tourEmit } from "@/lib/tour";
import { Seal } from "@/components/Seal";
import { Thumb } from "@/components/Thumb";

const WINDOWS = [
  { label: "5 min", ms: 5 * 60_000, note: "for trying the demo" },
  { label: "3 days", ms: 3 * 86_400_000 },
  { label: "7 days", ms: 7 * 86_400_000 },
  { label: "14 days", ms: 14 * 86_400_000 },
];

const fmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });

export function CreateForm({ sellerName, lockBps, tier }: { sellerName: string; lockBps: number; tier: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [windowIdx, setWindowIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (readTour()?.step === 0) {
      setTitle(DEMO_TEXT.link.title);
      setPrice(DEMO_TEXT.link.price);
      setDescription(DEMO_TEXT.link.description);
      setWindowIdx(0);
    }
  }, []);

  const priceNum = Number(price) || 0;
  const held = Math.floor(priceNum * lockBps) / 10_000;
  const win = WINDOWS[windowIdx];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, price, image: image || null, claim_window_ms: win.ms }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "The link wasn't created.");
      setBusy(false);
      return;
    }
    tourEmit("link", { id: String(data.id) });
    router.push(`/p/${data.id}/ready`);
  }

  return (
    <form className="card create-card" onSubmit={submit}>
      <label className="field">
        What are you selling?
        <input required maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Leather market tote" />
      </label>

      <label className="field">
        Price
        <span className="price-input">
          <input
            required
            inputMode="decimal"
            pattern="^\d+(\.\d{1,2})?$"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="120"
            aria-describedby="price-unit"
          />
          <span id="price-unit">USDC</span>
        </span>
      </label>

      <label className="field">
        Short description
        <textarea
          required
          maxLength={280}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What it is, size, condition. This is what the AI judge checks claims against."
        />
      </label>

      <label className="field">
        Photo link <span className="hint">(optional, e.g. the image from your Instagram post. It also becomes the picture on the buyer's receipt NFT)</span>
        <input type="url" maxLength={256} value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://" />
      </label>

      <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
        <legend className="label" style={{ padding: 0, marginBottom: "0.4rem" }}>Buyer can claim for</legend>
        <div className="segmented">
          {WINDOWS.map((w, i) => (
            <button type="button" key={w.label} aria-pressed={i === windowIdx} onClick={() => setWindowIdx(i)}>
              {w.label}
            </button>
          ))}
        </div>
        {win.note && <p className="small muted" style={{ marginTop: "0.35rem" }}>5 minutes is {win.note}. Real sales use days.</p>}
      </fieldset>

      <div style={{ display: "grid", gap: "0.4rem" }}>
        <span className="label">Live preview for your buyer</span>
        <div className="preview">
          <Thumb image={image || null} title={title || "Your item"} />
          <div style={{ display: "grid", gap: "0.1rem" }}>
            <span className="preview-title">{title || "Your item"}</span>
            <span className="small" style={{ color: "rgba(255,255,255,0.7)" }}>
              {priceNum ? `${fmt(priceNum)} USDC` : "Price"} from {sellerName}
            </span>
            <span className="protect">
              <Seal size={14} />
              {priceNum ? `${fmt(held)} USDC` : `${lockBps / 100}%`} protected for {win.label}
            </span>
          </div>
        </div>
        <p className="small muted">
          {tier}, so {lockBps / 100}% is held. A clean record brings it down to 30%, then 15%.
        </p>
      </div>

      <button className="button full" type="submit" disabled={busy}>
        {busy ? "Creating your link…" : "Create protected link"}
      </button>
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  );
}
