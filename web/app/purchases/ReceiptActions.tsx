"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

async function post(body: object) {
  const res = await fetch("/api/act", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "That didn't go through.");
  return data;
}

export function WithdrawButton({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div style={{ display: "grid", gap: "0.4rem", justifyItems: "end" }}>
      <button
        className="button"
        disabled={disabled || busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await post({ action: "withdraw" });
            router.refresh();
          } catch (e) {
            setError((e as Error).message);
          }
          setBusy(false);
        }}
      >
        {busy ? "Withdrawing…" : "Withdraw to wallet"}
      </button>
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}

export function ReceiptActions({
  tokenId,
  status,
  claimOpen,
  others,
}: {
  tokenId: string;
  status: string;
  claimOpen: boolean;
  others: { key: string; name: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [to, setTo] = useState(others[0]?.key || "");
  const [done, setDone] = useState("");

  if (!claimOpen || status !== "Locked") return null;

  async function passOn() {
    setBusy(true);
    setError("");
    try {
      await post({ action: "pass_on", token_id: tokenId, to });
      const name = others.find((o) => o.key === to)?.name;
      setDone(`Passed on to ${name}. The protection went with it.`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <div className="receipt-actions">
      {others.length > 0 && (
        <div style={{ display: "grid", gap: "0.5rem" }}>
          <label className="field">
            Sold it? Pass the receipt on to
            <select value={to} onChange={(e) => setTo(e.target.value)}>
              {others.map((o) => (
                <option key={o.key} value={o.key}>{o.name}</option>
              ))}
            </select>
          </label>
          <button className="button quiet" onClick={passOn} disabled={busy}>
            {busy ? "Passing on…" : "Pass on receipt"}
          </button>
        </div>
      )}
      {done && <p className="small muted" aria-live="polite">{done}</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
