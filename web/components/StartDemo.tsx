"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { actAs, writeTour } from "@/lib/tour";

export function StartDemo({ className, label = "Try the 2-minute demo" }: { className: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className={className}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await actAs("atelier");
        writeTour({ step: 0 });
        router.push("/new");
        router.refresh();
      }}
    >
      {busy ? "Starting…" : label}
    </button>
  );
}
