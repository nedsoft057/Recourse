"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

type Person = { key: string; name: string; role: "buyer" | "seller" | "reviewer" };

export function IdentitySwitcher({ people, current }: { people: Person[]; current: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  async function choose(key: string) {
    await fetch("/api/identity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ as: key }),
    });
    start(() => router.refresh());
  }

  return (
    <label className="identity">
      <span className="identity-label">Viewing as</span>
      <select value={current} onChange={(e) => choose(e.target.value)} disabled={pending}>
        <optgroup label="Buyers">
          {people.filter((p) => p.role === "buyer").map((p) => (
            <option key={p.key} value={p.key}>{p.name}</option>
          ))}
        </optgroup>
        <optgroup label="Sellers">
          {people.filter((p) => p.role === "seller").map((p) => (
            <option key={p.key} value={p.key}>{p.name}</option>
          ))}
        </optgroup>
        <optgroup label="Disputes">
          {people.filter((p) => p.role === "reviewer").map((p) => (
            <option key={p.key} value={p.key}>{p.name}</option>
          ))}
        </optgroup>
      </select>
    </label>
  );
}
