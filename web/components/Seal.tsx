/** The protection mark. `on="dark"` for navy surfaces, `on="light"` for white ones. */
export function Seal({
  size = 18,
  on = "dark",
  title = "Protected",
  className = "",
}: {
  size?: number;
  on?: "dark" | "light";
  title?: string;
  className?: string;
}) {
  const ring = on === "dark" ? "#7FE6FF" : "#0789AE";
  const fill = on === "dark" ? "#36D3F2" : "#0789AE";
  const tick = on === "dark" ? "#06111F" : "#FFFFFF";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={title} className={`seal ${className}`}>
      <circle cx="12" cy="12" r="10.5" fill="none" stroke={ring} strokeWidth="1.5" strokeDasharray="2 1.6" />
      <circle cx="12" cy="12" r="7" fill={fill} />
      <path d="M8.6 12.2l2.2 2.2 4.6-4.8" fill="none" stroke={tick} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
