export type Tier = "New" | "Established" | "Trusted" | "Flagged";
export type Status =
  | "Locked"
  | "Disputed"
  | "Ruled"
  | "UnderReview"
  | "Appealed"
  | "Settled"
  | "Refunded"
  | "Split";

export type Listing = {
  merchant: string;
  title: string;
  description: string;
  image: string | null;
  price: string;
  claim_window_ms: number;
  active: boolean;
  sold: number;
};

export type ListingView = {
  id: number;
  listing: Listing;
  merchant_name: string;
  tier: Tier;
  lock_bps: number;
  seller_now: string;
  protected: string;
};

export type MerchantView = {
  account_id: string;
  merchant: {
    name: string;
    status: "Pending" | "Approved" | "Suspended";
    min_lock_bps: number;
    finished: number;
    lost: number;
    storage_balance: string;
  };
  tier: Tier;
  tier_bps: number;
  lock_bps: number;
  loss_bps: number;
};

export type Claim = {
  claimant: string;
  reason: string;
  buyer_evidence: string;
  opened_at: number;
  response_due: number;
  merchant_evidence: string | null;
  responded_at: number | null;
};

export type Ruling = {
  buyer_bps: number;
  ruling_hash: string;
  attestation_ref: string;
  ruled_at: number;
  appeal_ends: number;
  by_human: boolean;
  details: string;
};

export type Review = {
  kind: "Flagged" | "Appeal";
  reason: string;
  started_at: number;
  deadline: number;
  requested_by: string;
};

export type Escrow = {
  listing_id: number;
  merchant: string;
  original_buyer: string;
  price: string;
  locked: string;
  lock_bps: number;
  paid_at: number;
  claim_ends: number;
  status: Status;
  claim: Claim | null;
  ruling: Ruling | null;
  review: Review | null;
  final_buyer_bps: number | null;
  closed_at: number | null;
};

export type ReceiptView = {
  token_id: string;
  holder: string;
  listing_title: string;
  escrow: Escrow;
};
