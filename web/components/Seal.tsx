/** The protection mark. `on="dark"` for navy surfaces, `on="light"` for white ones. */
export function Seal({
  size = 18,
  on = "light",
  title = "Protected",
  className = "",
}: {
  size?: number;
  on?: "dark" | "light";
  title?: string;
  className?: string;
}) {
  const ring = on === "dark" ? "#9CC5FF" : "#1A73E8";
  const fill = on === "dark" ? "#5EA2FF" : "#1A73E8";
  const tick = on === "dark" ? "#06111F" : "#FFFFFF";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={title} className={`seal ${className}`}>
      <circle cx="12" cy="12" r="10.5" fill="none" stroke={ring} strokeWidth="1.5" strokeDasharray="2 1.6" />
      <circle cx="12" cy="12" r="7" fill={fill} />
      <path d="M8.6 12.2l2.2 2.2 4.6-4.8" fill="none" stroke={tick} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
