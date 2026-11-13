"use client";

import { useState } from "react";

// Warm, product-like gradients for links without a photo, picked from the title.
const GRADIENTS = [
  "linear-gradient(160deg, #B07C55, #6E4630)",
  "linear-gradient(160deg, #3D5A80, #1B2F4B)",
  "linear-gradient(160deg, #7A8B69, #45523A)",
  "linear-gradient(160deg, #C9B79C, #8C7A60)",
  "linear-gradient(160deg, #5E7A8C, #2E4250)",
  "linear-gradient(160deg, #A3665A, #5E342C)",
];

function pick(title: string) {
  let h = 0;
  for (const c of title) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

/** A link's photo, or a calm gradient when there's no photo or it fails to load. */
export function Thumb({
  image,
  title,
  className = "",
  eager = false,
}: {
  image: string | null | undefined;
  title: string;
  className?: string;
  eager?: boolean;
}) {
  const src = image || stockPhoto(title);
  const [failed, setFailed] = useState(false);
  return (
    <div className={`thumb ${className}`} style={{ background: pick(title) }}>
      {src && !failed && (
        <img src={src} alt={title} loading={eager ? "eager" : "lazy"} onError={() => setFailed(true)} />
      )}
    </div>
  );
}

/** Links made without a photo still get a real one when we have a match. */
function stockPhoto(title: string): string | null {
  return /tote|bag|leather|purse/i.test(title) ? "/products/market-tote.jpg" : null;
}
