import type { Escrow } from "./types";
import { usdc } from "./format";

/** One plain sentence describing where the held money stands, from the holder's side. */
export function statusFor(e: Escrow, now = Date.now()): { title: string; held: boolean } {
  const held = usdc(e.locked);
  switch (e.status) {
    case "Locked":
      return now < e.claim_ends
        ? { title: `${held} USDC held for you`, held: true }
        : { title: `Claim window closed, ${held} USDC due to the maker`, held: false };
    case "Disputed":
      return { title: `Claim open, ${held} USDC frozen`, held: true };
    case "Ruled":
      return { title: `Ruling made, money stays held until the appeal window closes`, held: true };
    case "UnderReview":
      return { title: `With a human reviewer, ${held} USDC frozen`, held: true };
    case "Appealed":
      return { title: `Ruling appealed, ${held} USDC frozen`, held: true };
    case "Settled":
      return { title: "Complete. The held amount went to the maker", held: false };
    case "Refunded":
      return { title: `Refunded ${held} USDC`, held: false };
    case "Split": {
      const toBuyer = (Number(e.locked) * (e.final_buyer_bps ?? 0)) / 10_000;
      return { title: `Split decision: ${usdc(toBuyer)} USDC refunded`, held: false };
    }
  }
}
