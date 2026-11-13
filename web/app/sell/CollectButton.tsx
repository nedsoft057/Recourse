"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CollectButton({ tokenIds }: { tokenIds: string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (tokenIds.length === 0) return null;
  return (
    <div style={{ display: "grid", gap: "0.4rem" }}>
      <button
        className="button quiet"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          const res = await fetch("/api/act", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "release_many", token_ids: tokenIds }),
          });
          const data = await res.json();
          if (!res.ok) setError(data.error || "That didn't go through.");
          setBusy(false);
          router.refresh();
        }}
      >
        {busy ? "Collecting…" : `Collect ${tokenIds.length} finished ${tokenIds.length === 1 ? "order" : "orders"}`}
      </button>
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
