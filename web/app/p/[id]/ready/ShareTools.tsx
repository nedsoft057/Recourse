"use client";

import { useState } from "react";

export function ShareTools({ url, title, price }: { url: string; title: string; price: string }) {
  const [copied, setCopied] = useState(false);
  const message = `${title}, ${price} USDC. Pay here with buyer protection: ${url}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function more() {
    if (navigator.share) {
      try {
        await navigator.share({ title, text: message, url });
      } catch {
        /* closed */
      }
    } else {
      await copy();
    }
  }

  return (
    <div className="card" style={{ padding: "0.9rem", display: "grid", gap: "0.75rem" }}>
      <label className="field">
        Your protected link
        <span className="link-field">
          <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
          <button type="button" className="button dark" style={{ padding: "0.6rem 0.9rem" }} onClick={copy}>
            {copied ? "Copied" : "Copy"}
          </button>
        </span>
      </label>
      <div className="share-row">
        <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#1A73E8" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20l1.3-4A8 8 0 1 1 8.5 19z" /></svg>
          WhatsApp
        </a>
        <button type="button" onClick={copy}>
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#1A73E8" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.8" fill="#1A73E8" /></svg>
          Copy for Instagram
        </button>
        <button type="button" onClick={more}>
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#1A73E8" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 8l5-5 5 5" /><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></svg>
          More
        </button>
      </div>
    </div>
  );
}
