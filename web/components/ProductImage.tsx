"use client";

import { useState } from "react";

export function ProductImage({
  slug,
  tone,
  alt,
  className = "",
  eager = false,
}: {
  slug: string;
  tone: string;
  alt: string;
  className?: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`product-image ${className}`} style={{ backgroundColor: tone }}>
      {!failed && (
        <img
          src={`/products/${slug}.jpg`}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
