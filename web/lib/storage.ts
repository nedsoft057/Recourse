import { act, view, MASTER } from "./chain";
import type { MerchantView } from "./types";

const LOW = 100_000_000_000_000_000_000_000n; // 0.1 NEAR covers about five receipts
const TOP_UP = 500_000_000_000_000_000_000_000n; // 0.5 NEAR

/**
 * Each listing and receipt is paid for from the seller's prepaid storage on the
 * contract. The platform tops sellers up so a sale never bounces for storage.
 */
export async function ensureStorage(merchant: string) {
  const m = await view<MerchantView | null>("get_merchant", { account_id: merchant });
  if (!m || BigInt(m.merchant.storage_balance) >= LOW) return;
  await act(MASTER, "add_storage_for", { account_id: merchant }, { deposit: TOP_UP, tgas: 10n });
}
