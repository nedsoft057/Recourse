export const USDC = 1_000_000;

export function usdc(raw: string | number | bigint): string {
  const n = Number(raw) / USDC;
  return n.toLocaleString("en-US", {
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export function pct(bps: number): string {
  return `${Math.round(bps / 100)}%`;
}

export const tierWords: Record<string, string> = {
  New: "New seller",
  Established: "Established seller",
  Trusted: "Trusted seller",
  Flagged: "Seller under review",
};

export function recordLine(finished: number, lost: number): string {
  if (finished === 0) return "No completed orders yet";
  const orders = `${finished} completed ${finished === 1 ? "order" : "orders"}`;
  if (lost === 0) return `${orders}, no lost claims`;
  return `${orders}, ${lost} lost ${lost === 1 ? "claim" : "claims"}`;
}

export function minutes(ms: number): string {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m} minutes`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} hours`;
  return `${Math.round(h / 24)} days`;
}
