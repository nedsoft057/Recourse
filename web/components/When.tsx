"use client";

import { useEffect, useState } from "react";

/** A time shown in the viewer's own timezone, e.g. "14 Nov, 15:42". */
export function When({ ms }: { ms: number }) {
  const [text, setText] = useState("");
  useEffect(() => {
    setText(
      new Date(ms).toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    );
  }, [ms]);
  return <time dateTime={new Date(ms).toISOString()}>{text || "…"}</time>;
}

/** Live countdown: "12 min left", "40 s left", or "now". */
export function Countdown({ ms }: { ms: number }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (now === null) return <span>…</span>;
  const left = ms - now;
  if (left <= 0) return <span>now</span>;
  const s = Math.floor(left / 1000);
  if (s < 60) return <span>{s} s left</span>;
  const m = Math.floor(s / 60);
  if (m < 120) return <span>{m} min left</span>;
  const h = Math.floor(m / 60);
  if (h < 48) return <span>{h} h left</span>;
  return <span>{Math.floor(h / 24)} days left</span>;
}
