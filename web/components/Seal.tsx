/** The protection mark: a small indigo stamp. Used only where money is held for a buyer. */
export function Seal({ size = 18, title = "Protected" }: { size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label={title}
      className="seal"
    >
      <circle cx="12" cy="12" r="10.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 1.6" />
      <circle cx="12" cy="12" r="7" fill="currentColor" />
      <path d="M8.6 12.2l2.2 2.2 4.6-4.8" fill="none" stroke="var(--paper)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
