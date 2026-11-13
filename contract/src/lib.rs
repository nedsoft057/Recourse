//! Recourse: buyer protection for stablecoin payments.
//!
//! When a buyer pays for a listing, part of the payment goes to the seller
//! immediately and the rest stays locked in a receipt NFT held by the buyer.
//! The locked part goes to the seller when the claim window ends, or back to
//! whoever holds the receipt if a claim succeeds. Receipts are transferable,
//! so the protection travels with the item when it is resold.
//!
//! All times are milliseconds since the Unix epoch (safe as JSON numbers).
//! All amounts are token base units (USDC has 6 decimals) as U128 strings.

use near_contract_standards::fungible_token::core::ext_ft_core;
use near_contract_standards::fungible_token::receiver::FungibleTokenReceiver;
use near_contract_standards::non_fungible_token::core::{
    NonFungibleTokenCore, NonFungibleTokenResolver,
};
use near_contract_standards::non_fungible_token::enumeration::NonFungibleTokenEnumeration;
use near_contract_standards::non_fungible_token::metadata::{
    NFTContractMetadata, NonFungibleTokenMetadataProvider, TokenMetadata, NFT_METADATA_SPEC,
};
use near_contract_standards::non_fungible_token::events::NftMint;
use near_contract_standards::non_fungible_token::{NonFungibleToken, Token, TokenId};
use near_sdk::json_types::U128;
use near_sdk::store::{LookupMap, Vector};
use near_sdk::{
    assert_one_yocto, env, near, require, AccountId, BorshStorageKey, Gas, NearToken,
    PanicOnDefault, Promise, PromiseOrValue,
};
use std::collections::HashMap;

const BPS: u128 = 10_000;
const GAS_FT_TRANSFER: Gas = Gas::from_tgas(10);
const GAS_CALLBACK: Gas = Gas::from_tgas(10);

/// Fixed storage charges, taken from the merchant's prepaid storage balance.
/// Set comfortably above measured usage so the contract never runs short.
const STORAGE_MERCHANT: u128 = 10_000_000_000_000_000_000_000; // 0.01 NEAR
const STORAGE_LISTING: u128 = 10_000_000_000_000_000_000_000; // 0.01 NEAR
const MAX_EXTENSION_MS: u64 = 7 * 86_400_000;
const STORAGE_RECEIPT: u128 = 20_000_000_000_000_000_000_000; // 0.02 NEAR

/// The web app. Listing photos stored as site paths ("/products/x.jpg") are
/// turned into full URLs in the receipt NFT so wallets and explorers can show them.
const SITE_URL: &str = "https://recourse-market.vercel.app";

const MIN_CLAIM_WINDOW_MS: u64 = 60_000; // 1 minute (demo)
const MAX_CLAIM_WINDOW_MS: u64 = 90 * 24 * 60 * 60 * 1000; // 90 days
const MAX_TEXT: usize = 280;
const MAX_HASH: usize = 128;
const MAX_EVIDENCE: usize = 3_000;
const MAX_DETAILS: usize = 2_000;

// ---------------------------------------------------------------- types

#[near(serializers = [borsh])]
#[derive(BorshStorageKey)]
pub enum StorageKey {
    Merchants,
    Listings,
    Escrows,
    Balances,
    MerchantReceipts,
    Evidence,
    NftOwners,
    NftMetadata,
    NftEnumeration,
    Buyers,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub enum MerchantStatus {
    Pending,
    Approved,
    Suspended,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub enum Tier {
    New,
    Established,
    Trusted,
    Flagged,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub enum Status {
    /// Paid, inside the claim window, no claim.
    Locked,
    /// Claim open, waiting for merchant response and a ruling.
    Disputed,
    /// AI ruling recorded; funds still locked until the appeal window closes.
    Ruled,
    /// The AI could not rule; waiting for a human reviewer.
    UnderReview,
    /// An AI ruling was appealed; waiting for a human reviewer.
    Appealed,
    /// Final: all locked funds went to the merchant.
    Settled,
    /// Final: all locked funds went to the receipt holder.
    Refunded,
    /// Final: locked funds were split.
    Split,
}

impl Status {
    fn is_final(&self) -> bool {
        matches!(self, Status::Settled | Status::Refunded | Status::Split)
    }
    fn blocks_transfer(&self) -> bool {
        matches!(
            self,
            Status::Disputed | Status::Ruled | Status::UnderReview | Status::Appealed
        )
    }
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Tiers {
    pub new_below_finished: u32,
    pub new_bps: u16,
    pub established_bps: u16,
    pub trusted_min_finished: u32,
    pub trusted_max_loss_bps: u16,
    pub trusted_bps: u16,
    pub flag_min_lost: u32,
    pub flag_min_loss_bps: u16,
    pub flag_bps: u16,
}

impl Default for Tiers {
    fn default() -> Self {
        Self {
            new_below_finished: 5,
            new_bps: 5_000,
            established_bps: 3_000,
            trusted_min_finished: 20,
            trusted_max_loss_bps: 500,
            trusted_bps: 1_500,
            flag_min_lost: 3,
            flag_min_loss_bps: 2_000,
            flag_bps: 10_000,
        }
    }
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Config {
    pub owner: AccountId,
    pub judge: AccountId,
    pub relayer: AccountId,
    pub token: AccountId,
    pub response_ms: u64,
    pub appeal_ms: u64,
    pub review_ms: u64,
    pub tiers: Tiers,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Merchant {
    pub name: String,
    pub status: MerchantStatus,
    /// Merchant-chosen minimum lock rate. The effective rate is the higher of
    /// this and the tier rate, so a merchant can raise protection, never lower it.
    pub min_lock_bps: u16,
    pub finished: u32,
    pub lost: u32,
    pub storage_balance: U128,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Listing {
    pub merchant: AccountId,
    pub title: String,
    pub description: String,
    pub image: Option<String>,
    pub price: U128,
    pub claim_window_ms: u64,
    pub active: bool,
    pub sold: u32,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Claim {
    pub claimant: AccountId,
    pub reason: String,
    pub buyer_evidence: String,
    pub opened_at: u64,
    pub response_due: u64,
    pub merchant_evidence: Option<String>,
    pub responded_at: Option<u64>,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Ruling {
    pub buyer_bps: u16,
    pub ruling_hash: String,
    pub attestation_ref: String,
    pub ruled_at: u64,
    pub appeal_ends: u64,
    pub by_human: bool,
    /// Public record of how the decision was reached: the AI ruling JSON plus
    /// the enclave signature reference, or the human reviewer's note.
    pub details: String,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub enum ReviewKind {
    Flagged,
    Appeal,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Review {
    pub kind: ReviewKind,
    pub reason: String,
    pub started_at: u64,
    pub deadline: u64,
    pub requested_by: AccountId,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Escrow {
    pub listing_id: u32,
    pub merchant: AccountId,
    pub original_buyer: AccountId,
    pub price: U128,
    pub locked: U128,
    pub lock_bps: u16,
    pub paid_at: u64,
    pub claim_ends: u64,
    pub status: Status,
    pub claim: Option<Claim>,
    pub ruling: Option<Ruling>,
    pub review: Option<Review>,
    pub final_buyer_bps: Option<u16>,
    pub closed_at: Option<u64>,
    /// The holder can push the claim window back once (e.g. a slow delivery).
    pub extended: bool,
}

/// A buyer's claim history, visible to sellers and to the judge.
#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, Default)]
pub struct BuyerRecord {
    /// Claims opened.
    pub claims: u32,
    /// Claims decided at least half in the buyer's favour (or refunded by the seller).
    pub won: u32,
    /// Claims decided mostly for the seller.
    pub lost: u32,
}

#[near(serializers = [json])]
pub struct PayMsg {
    pub listing_id: u32,
    pub buyer: Option<AccountId>,
}

#[near(serializers = [json])]
pub struct MerchantView {
    pub account_id: AccountId,
    pub merchant: Merchant,
    pub tier: Tier,
    pub tier_bps: u16,
    pub lock_bps: u16,
    pub loss_bps: u16,
}

#[near(serializers = [json])]
pub struct ListingView {
    pub id: u32,
    pub listing: Listing,
    pub merchant_name: String,
    pub tier: Tier,
    pub lock_bps: u16,
    pub seller_now: U128,
    pub protected: U128,
}

#[near(serializers = [json])]
pub struct ReceiptView {
    pub token_id: TokenId,
    pub holder: AccountId,
    pub listing_title: String,
    pub escrow: Escrow,
}

// ---------------------------------------------------------------- contract

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Recourse {
    config: Config,
    tokens: NonFungibleToken,
    merchants: LookupMap<AccountId, Merchant>,
    listings: Vector<Listing>,
    escrows: LookupMap<TokenId, Escrow>,
    balances: LookupMap<AccountId, U128>,
    merchant_receipts: LookupMap<AccountId, Vec<TokenId>>,
    /// Encrypted evidence, keyed "<token_id>:buyer" and "<token_id>:merchant".
    /// Only its hash is part of the claim; the backend and the judge decrypt it.
    evidence: LookupMap<String, String>,
    next_receipt: u64,
    buyers: LookupMap<AccountId, BuyerRecord>,
}

fn now_ms() -> u64 {
    env::block_timestamp_ms()
}

fn check_text(value: &str, max: usize, field: &str) {
    require!(
        !value.is_empty() && value.len() <= max,
        format!("{field} must be 1-{max} characters")
    );
}

fn event(kind: &str, data: String) {
    env::log_str(&format!(
        "EVENT_JSON:{{\"standard\":\"recourse\",\"version\":\"1.0.0\",\"event\":\"{kind}\",\"data\":{data}}}"
    ));
}

#[near]
impl Recourse {
    #[init]
    pub fn new(
        owner: AccountId,
        judge: AccountId,
        relayer: AccountId,
        token: AccountId,
        response_ms: u64,
        appeal_ms: u64,
        review_ms: u64,
    ) -> Self {
        Self {
            config: Config {
                owner,
                judge,
                relayer,
                token,
                response_ms,
                appeal_ms,
                review_ms,
                tiers: Tiers::default(),
            },
            tokens: NonFungibleToken::new(
                StorageKey::NftOwners,
                env::current_account_id(),
                Some(StorageKey::NftMetadata),
                Some(StorageKey::NftEnumeration),
                None::<StorageKey>,
            ),
            merchants: LookupMap::new(StorageKey::Merchants),
            listings: Vector::new(StorageKey::Listings),
            escrows: LookupMap::new(StorageKey::Escrows),
            balances: LookupMap::new(StorageKey::Balances),
            merchant_receipts: LookupMap::new(StorageKey::MerchantReceipts),
            evidence: LookupMap::new(StorageKey::Evidence),
            next_receipt: 1,
            buyers: LookupMap::new(StorageKey::Buyers),
        }
    }

    // ------------------------------------------------------------ owner

    pub fn approve_merchant(&mut self, account_id: AccountId) {
        self.assert_owner();
        let m = self.merchants.get_mut(&account_id).expect("Merchant not found");
        m.status = MerchantStatus::Approved;
        event("merchant_approved", format!("{{\"merchant\":\"{account_id}\"}}"));
    }

    pub fn suspend_merchant(&mut self, account_id: AccountId) {
        self.assert_owner();
        let m = self.merchants.get_mut(&account_id).expect("Merchant not found");
        m.status = MerchantStatus::Suspended;
        event("merchant_suspended", format!("{{\"merchant\":\"{account_id}\"}}"));
    }

    pub fn set_judge(&mut self, judge: AccountId) {
        self.assert_owner();
        self.config.judge = judge;
    }

    pub fn set_relayer(&mut self, relayer: AccountId) {
        self.assert_owner();
        self.config.relayer = relayer;
    }

    pub fn set_windows(&mut self, response_ms: u64, appeal_ms: u64, review_ms: u64) {
        self.assert_owner();
        self.config.response_ms = response_ms;
        self.config.appeal_ms = appeal_ms;
        self.config.review_ms = review_ms;
    }

    pub fn set_tiers(&mut self, tiers: Tiers) {
        self.assert_owner();
        for bps in [
            tiers.new_bps,
            tiers.established_bps,
            tiers.trusted_bps,
            tiers.flag_bps,
        ] {
            require!(bps as u128 <= BPS, "Lock rates must be at most 10000 bps");
        }
        self.config.tiers = tiers;
    }

    // ------------------------------------------------------------ merchants

    /// Creates a pending merchant profile. Attached NEAR prepays storage.
    /// The merchant cannot sell until the owner approves them.
    #[payable]
    pub fn register_merchant(&mut self, name: String) {
        let account_id = env::predecessor_account_id();
        require!(
            self.merchants.get(&account_id).is_none(),
            "Merchant already registered"
        );
        check_text(&name, 64, "Name");
        let attached = env::attached_deposit().as_yoctonear();
        require!(
            attached >= STORAGE_MERCHANT + STORAGE_LISTING,
            "Attach at least 0.02 NEAR to prepay storage"
        );
        self.merchants.insert(
            account_id.clone(),
            Merchant {
                name,
                status: MerchantStatus::Pending,
                min_lock_bps: 0,
                finished: 0,
                lost: 0,
                storage_balance: U128(attached - STORAGE_MERCHANT),
            },
        );
        event("merchant_registered", format!("{{\"merchant\":\"{account_id}\"}}"));
    }

    #[payable]
    pub fn add_storage(&mut self) {
        let account_id = env::predecessor_account_id();
        let attached = env::attached_deposit().as_yoctonear();
        let m = self.merchants.get_mut(&account_id).expect("Merchant not found");
        m.storage_balance = U128(m.storage_balance.0 + attached);
    }

    /// Anyone can top up a merchant's prepaid storage (e.g. a platform
    /// sponsoring its sellers). It only adds funds; it changes nothing else.
    #[payable]
    pub fn add_storage_for(&mut self, account_id: AccountId) {
        let attached = env::attached_deposit().as_yoctonear();
        let m = self.merchants.get_mut(&account_id).expect("Merchant not found");
        m.storage_balance = U128(m.storage_balance.0 + attached);
    }

    /// Raise the minimum share locked on future sales. Values below the
    /// merchant's tier rate have no effect: the higher of the two applies.
    pub fn set_min_lock_bps(&mut self, bps: u16) {
        require!(bps as u128 <= BPS, "At most 10000 bps");
        let account_id = env::predecessor_account_id();
        let m = self.merchants.get_mut(&account_id).expect("Merchant not found");
        m.min_lock_bps = bps;
    }

    pub fn create_listing(
        &mut self,
        title: String,
        description: String,
        image: Option<String>,
        price: U128,
        claim_window_ms: u64,
    ) -> u32 {
        let merchant = env::predecessor_account_id();
        self.assert_approved(&merchant);
        check_text(&title, 80, "Title");
        check_text(&description, MAX_TEXT, "Description");
        if let Some(url) = &image {
            check_text(url, 256, "Image URL");
        }
        require!(price.0 > 0, "Price must be positive");
        require!(
            (MIN_CLAIM_WINDOW_MS..=MAX_CLAIM_WINDOW_MS).contains(&claim_window_ms),
            "Claim window must be between 1 minute and 90 days"
        );
        self.charge_storage(&merchant, STORAGE_LISTING);
        let id = self.listings.len();
        self.listings.push(Listing {
            merchant: merchant.clone(),
            title,
            description,
            image,
            price,
            claim_window_ms,
            active: true,
            sold: 0,
        });
        event(
            "listing_created",
            format!("{{\"listing_id\":{id},\"merchant\":\"{merchant}\"}}"),
        );
        id
    }

    pub fn set_listing_active(&mut self, listing_id: u32, active: bool) {
        let caller = env::predecessor_account_id();
        let listing = self.listings.get_mut(listing_id).expect("Listing not found");
        require!(listing.merchant == caller, "Only the listing's merchant");
        listing.active = active;
    }

    // ------------------------------------------------------------ settlement

    /// After the claim window with no claim: the locked part goes to the merchant.
    pub fn release(&mut self, token_id: TokenId) {
        require!(self.try_release(&token_id), "Not releasable yet");
    }

    /// Releases every eligible receipt in the list; skips the rest.
    pub fn release_many(&mut self, token_ids: Vec<TokenId>) -> u32 {
        require!(token_ids.len() <= 50, "At most 50 at a time");
        let mut released = 0;
        for id in token_ids {
            if self.try_release(&id) {
                released += 1;
            }
        }
        released
    }

    /// Merchant sends the locked part back to the receipt holder, at any time
    /// before a ruling. Counts as a finished order, not a lost dispute.
    pub fn refund(&mut self, token_id: TokenId) {
        let caller = env::predecessor_account_id();
        let holder = self.holder(&token_id);
        let e = self.escrows.get_mut(&token_id).expect("Receipt not found");
        require!(e.merchant == caller, "Only the merchant");
        require!(
            matches!(e.status, Status::Locked | Status::Disputed),
            "Can't refund in this state"
        );
        let amount = e.locked.0;
        let merchant = e.merchant.clone();
        let claimant = e.claim.as_ref().map(|c| c.claimant.clone());
        e.status = Status::Refunded;
        e.final_buyer_bps = Some(10_000);
        e.closed_at = Some(now_ms());
        self.credit(&holder, amount);
        if let Some(c) = claimant {
            self.record_buyer(&c, |r| r.won += 1);
        }
        self.merchants.get_mut(&merchant).unwrap().finished += 1;
        event(
            "refunded_voluntarily",
            format!("{{\"token_id\":\"{token_id}\",\"to\":\"{holder}\"}}"),
        );
    }

    // ------------------------------------------------------------ disputes

    /// The holder pushes the claim window back once, by the original window
    /// length (at most 7 days). For deliveries slower than the window.
    pub fn extend_window(&mut self, token_id: TokenId) {
        let caller = env::predecessor_account_id();
        require!(self.holder(&token_id) == caller, "Only the receipt holder");
        let now = now_ms();
        let e = self.escrows.get_mut(&token_id).expect("Receipt not found");
        require!(e.status == Status::Locked, "Receipt is not open");
        require!(now < e.claim_ends, "Claim window has ended");
        require!(!e.extended, "The window can only be extended once");
        let extra = (e.claim_ends - e.paid_at).min(MAX_EXTENSION_MS);
        e.claim_ends += extra;
        e.extended = true;
        let ends = e.claim_ends;
        event(
            "window_extended",
            format!("{{\"token_id\":\"{token_id}\",\"claim_ends\":{ends}}}"),
        );
    }

    pub fn open_claim(
        &mut self,
        token_id: TokenId,
        reason: String,
        evidence_hash: String,
        evidence: String,
    ) {
        let caller = env::predecessor_account_id();
        require!(self.holder(&token_id) == caller, "Only the receipt holder");
        check_text(&reason, 64, "Reason");
        check_text(&evidence_hash, MAX_HASH, "Evidence hash");
        check_text(&evidence, MAX_EVIDENCE, "Evidence");
        self.evidence.insert(format!("{token_id}:buyer"), evidence);
        let now = now_ms();
        let response_ms = self.config.response_ms;
        let e = self.escrows.get_mut(&token_id).expect("Receipt not found");
        require!(e.status == Status::Locked, "Receipt is not open for claims");
        require!(now < e.claim_ends, "Claim window has ended");
        e.status = Status::Disputed;
        e.claim = Some(Claim {
            claimant: caller.clone(),
            reason,
            buyer_evidence: evidence_hash,
            opened_at: now,
            response_due: now + response_ms,
            merchant_evidence: None,
            responded_at: None,
        });
        self.record_buyer(&caller, |r| r.claims += 1);
        event(
            "claim_opened",
            format!("{{\"token_id\":\"{token_id}\",\"by\":\"{caller}\"}}"),
        );
    }

    pub fn respond(&mut self, token_id: TokenId, evidence_hash: String, evidence: String) {
        let caller = env::predecessor_account_id();
        check_text(&evidence_hash, MAX_HASH, "Evidence hash");
        check_text(&evidence, MAX_EVIDENCE, "Evidence");
        self.evidence.insert(format!("{token_id}:merchant"), evidence);
        let now = now_ms();
        let e = self.escrows.get_mut(&token_id).expect("Receipt not found");
        require!(e.merchant == caller, "Only the merchant");
        require!(e.status == Status::Disputed, "No open claim");
        let claim = e.claim.as_mut().unwrap();
        require!(claim.responded_at.is_none(), "Already responded");
        require!(now < claim.response_due, "Response window has ended");
        claim.merchant_evidence = Some(evidence_hash);
        claim.responded_at = Some(now);
        event("merchant_responded", format!("{{\"token_id\":\"{token_id}\"}}"));
    }

    /// Merchant never responded in time: full refund to the receipt holder.
    pub fn default_judgment(&mut self, token_id: TokenId) {
        let e = self.escrows.get(&token_id).expect("Receipt not found");
        require!(e.status == Status::Disputed, "No open claim");
        let claim = e.claim.as_ref().unwrap();
        require!(claim.responded_at.is_none(), "Merchant responded");
        require!(now_ms() >= claim.response_due, "Response window still open");
        self.execute(&token_id, 10_000);
    }

    /// Judge records the AI ruling. No money moves until the appeal window closes.
    pub fn post_ruling(
        &mut self,
        token_id: TokenId,
        buyer_bps: u16,
        ruling_hash: String,
        attestation_ref: String,
        details: String,
    ) {
        self.assert_judge();
        check_text(&details, MAX_DETAILS, "Details");
        require!(buyer_bps as u128 <= BPS, "At most 10000 bps");
        check_text(&ruling_hash, MAX_HASH, "Ruling hash");
        check_text(&attestation_ref, MAX_TEXT, "Attestation reference");
        let now = now_ms();
        let appeal_ms = self.config.appeal_ms;
        let e = self.escrows.get_mut(&token_id).expect("Receipt not found");
        require!(e.status == Status::Disputed, "No open claim");
        require!(
            e.claim.as_ref().unwrap().responded_at.is_some(),
            "Merchant hasn't responded; use default_judgment"
        );
        e.status = Status::Ruled;
        e.ruling = Some(Ruling {
            buyer_bps,
            ruling_hash,
            attestation_ref,
            ruled_at: now,
            appeal_ends: now + appeal_ms,
            by_human: false,
            details,
        });
        event(
            "ruling_posted",
            format!("{{\"token_id\":\"{token_id}\",\"buyer_bps\":{buyer_bps}}}"),
        );
    }

    /// Judge sends a case the AI couldn't rule on to human review.
    pub fn flag_for_review(&mut self, token_id: TokenId, reason: String) {
        self.assert_judge();
        check_text(&reason, MAX_TEXT, "Reason");
        let now = now_ms();
        let review_ms = self.config.review_ms;
        let judge = self.config.judge.clone();
        let e = self.escrows.get_mut(&token_id).expect("Receipt not found");
        require!(e.status == Status::Disputed, "No open claim");
        e.status = Status::UnderReview;
        e.review = Some(Review {
            kind: ReviewKind::Flagged,
            reason,
            started_at: now,
            deadline: now + review_ms,
            requested_by: judge,
        });
        event("flagged_for_review", format!("{{\"token_id\":\"{token_id}\"}}"));
    }

    /// Receipt holder or merchant appeals an AI ruling once, inside the window.
    pub fn appeal(&mut self, token_id: TokenId, reason: String) {
        let caller = env::predecessor_account_id();
        check_text(&reason, MAX_TEXT, "Reason");
        let holder = self.holder(&token_id);
        let now = now_ms();
        let review_ms = self.config.review_ms;
        let e = self.escrows.get_mut(&token_id).expect("Receipt not found");
        require!(
            caller == holder || caller == e.merchant,
            "Only the receipt holder or the merchant"
        );
        require!(e.status == Status::Ruled, "Nothing to appeal");
        let ruling = e.ruling.as_ref().unwrap();
        require!(!ruling.by_human, "Human rulings are final");
        require!(now < ruling.appeal_ends, "Appeal window has ended");
        e.status = Status::Appealed;
        e.review = Some(Review {
            kind: ReviewKind::Appeal,
            reason,
            started_at: now,
            deadline: now + review_ms,
            requested_by: caller.clone(),
        });
        event(
            "appealed",
            format!("{{\"token_id\":\"{token_id}\",\"by\":\"{caller}\"}}"),
        );
    }

    /// After the appeal window closes with no appeal: executes the AI ruling.
    pub fn finalize(&mut self, token_id: TokenId) {
        let e = self.escrows.get(&token_id).expect("Receipt not found");
        require!(e.status == Status::Ruled, "No ruling waiting");
        let ruling = e.ruling.as_ref().unwrap();
        require!(now_ms() >= ruling.appeal_ends, "Appeal window still open");
        let bps = ruling.buyer_bps;
        self.execute(&token_id, bps);
    }

    /// Owner decides a flagged case or an appeal. Final and immediate.
    pub fn resolve_review(
        &mut self,
        token_id: TokenId,
        buyer_bps: u16,
        note_hash: String,
        note: String,
    ) {
        self.assert_owner();
        check_text(&note, MAX_DETAILS, "Note");
        require!(buyer_bps as u128 <= BPS, "At most 10000 bps");
        check_text(&note_hash, MAX_HASH, "Note hash");
        let now = now_ms();
        let e = self.escrows.get_mut(&token_id).expect("Receipt not found");
        require!(
            matches!(e.status, Status::UnderReview | Status::Appealed),
            "Nothing to review"
        );
        e.ruling = Some(Ruling {
            buyer_bps,
            ruling_hash: note_hash,
            attestation_ref: "human-review".to_string(),
            ruled_at: now,
            appeal_ends: now,
            by_human: true,
            details: note,
        });
        self.execute(&token_id, buyer_bps);
    }

    /// A review or appeal not decided in time refunds the receipt holder,
    /// so locked funds can never be stuck.
    pub fn review_timeout(&mut self, token_id: TokenId) {
        let e = self.escrows.get(&token_id).expect("Receipt not found");
        require!(
            matches!(e.status, Status::UnderReview | Status::Appealed),
            "Nothing under review"
        );
        require!(
            now_ms() >= e.review.as_ref().unwrap().deadline,
            "Review deadline not reached"
        );
        self.execute(&token_id, 10_000);
    }

    // ------------------------------------------------------------ withdraw

    #[payable]
    pub fn withdraw(&mut self) -> Promise {
        assert_one_yocto();
        let account_id = env::predecessor_account_id();
        let amount = self.balances.remove(&account_id).map(|b| b.0).unwrap_or(0);
        require!(amount > 0, "Nothing to withdraw");
        ext_ft_core::ext(self.config.token.clone())
            .with_attached_deposit(NearToken::from_yoctonear(1))
            .with_static_gas(GAS_FT_TRANSFER)
            .ft_transfer(
                account_id.clone(),
                U128(amount),
                Some("Recourse withdrawal".to_string()),
            )
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_CALLBACK)
                    .on_withdraw(account_id, U128(amount)),
            )
    }

    #[private]
    pub fn on_withdraw(&mut self, account_id: AccountId, amount: U128) -> bool {
        if !near_sdk::is_promise_success() {
            // Transfer failed (e.g. receiver not registered with the token):
            // put the money back so it can be withdrawn later.
            self.credit(&account_id, amount.0);
            false
        } else {
            true
        }
    }

    // ------------------------------------------------------------ views

    pub fn get_config(&self) -> Config {
        self.config.clone()
    }

    pub fn get_merchant(&self, account_id: AccountId) -> Option<MerchantView> {
        let m = self.merchants.get(&account_id)?.clone();
        let (tier, tier_bps, loss_bps) = self.tier_of(&m);
        let lock_bps = tier_bps.max(m.min_lock_bps);
        Some(MerchantView {
            account_id,
            merchant: m,
            tier,
            tier_bps,
            lock_bps,
            loss_bps,
        })
    }

    pub fn get_listing(&self, listing_id: u32) -> Option<ListingView> {
        let listing = self.listings.get(listing_id)?.clone();
        Some(self.listing_view(listing_id, listing))
    }

    pub fn get_listings(&self, from_index: Option<u32>, limit: Option<u32>) -> Vec<ListingView> {
        let from = from_index.unwrap_or(0);
        let limit = limit.unwrap_or(50).min(100);
        (from..self.listings.len())
            .take(limit as usize)
            .filter_map(|i| self.get_listing(i))
            .collect()
    }

    pub fn get_receipt(&self, token_id: TokenId) -> Option<ReceiptView> {
        let escrow = self.escrows.get(&token_id)?.clone();
        let holder = self.tokens.owner_by_id.get(&token_id)?;
        let listing_title = self
            .listings
            .get(escrow.listing_id)
            .map(|l| l.title.clone())
            .unwrap_or_default();
        Some(ReceiptView {
            token_id,
            holder,
            listing_title,
            escrow,
        })
    }

    pub fn get_merchant_receipts(
        &self,
        account_id: AccountId,
        from_index: Option<u32>,
        limit: Option<u32>,
    ) -> Vec<ReceiptView> {
        let ids = match self.merchant_receipts.get(&account_id) {
            Some(ids) => ids.clone(),
            None => return vec![],
        };
        ids.into_iter()
            .rev()
            .skip(from_index.unwrap_or(0) as usize)
            .take(limit.unwrap_or(50).min(100) as usize)
            .filter_map(|id| self.get_receipt(id))
            .collect()
    }

    /// Encrypted evidence for a receipt: (buyer's, merchant's).
    pub fn get_evidence(&self, token_id: TokenId) -> (Option<String>, Option<String>) {
        (
            self.evidence.get(&format!("{token_id}:buyer")).cloned(),
            self.evidence.get(&format!("{token_id}:merchant")).cloned(),
        )
    }

    pub fn get_buyer(&self, account_id: AccountId) -> BuyerRecord {
        self.buyers.get(&account_id).cloned().unwrap_or_default()
    }

    pub fn get_balance(&self, account_id: AccountId) -> U128 {
        self.balances.get(&account_id).copied().unwrap_or(U128(0))
    }

    // ------------------------------------------------------------ internals

    fn record_buyer(&mut self, account: &AccountId, f: impl FnOnce(&mut BuyerRecord)) {
        let mut r = self.buyers.get(account).cloned().unwrap_or_default();
        f(&mut r);
        self.buyers.insert(account.clone(), r);
    }

    fn assert_owner(&self) {
        require!(
            env::predecessor_account_id() == self.config.owner,
            "Only the owner"
        );
    }

    fn assert_judge(&self) {
        require!(
            env::predecessor_account_id() == self.config.judge,
            "Only the judge"
        );
    }

    fn assert_approved(&self, merchant: &AccountId) {
        let m = self.merchants.get(merchant).expect("Not a registered merchant");
        require!(
            m.status == MerchantStatus::Approved,
            "Merchant is not approved"
        );
    }

    fn charge_storage(&mut self, merchant: &AccountId, amount: u128) {
        let m = self.merchants.get_mut(merchant).expect("Merchant not found");
        require!(
            m.storage_balance.0 >= amount,
            "Merchant storage balance too low; call add_storage"
        );
        m.storage_balance = U128(m.storage_balance.0 - amount);
    }

    fn holder(&self, token_id: &TokenId) -> AccountId {
        self.tokens
            .owner_by_id
            .get(token_id)
            .unwrap_or_else(|| env::panic_str("Receipt not found"))
    }

    fn credit(&mut self, account_id: &AccountId, amount: u128) {
        if amount == 0 {
            return;
        }
        let current = self.balances.get(account_id).map(|b| b.0).unwrap_or(0);
        self.balances
            .insert(account_id.clone(), U128(current + amount));
    }

    /// Returns (tier, tier lock bps, loss bps). Loss rate = lost / finished,
    /// only computed when there is at least one finished order.
    fn tier_of(&self, m: &Merchant) -> (Tier, u16, u16) {
        let t = &self.config.tiers;
        let loss_bps: u16 = if m.finished == 0 {
            0
        } else {
            ((m.lost as u64 * 10_000) / m.finished as u64) as u16
        };
        if m.lost >= t.flag_min_lost && loss_bps >= t.flag_min_loss_bps {
            (Tier::Flagged, t.flag_bps, loss_bps)
        } else if m.finished < t.new_below_finished {
            (Tier::New, t.new_bps, loss_bps)
        } else if m.finished >= t.trusted_min_finished && loss_bps < t.trusted_max_loss_bps {
            (Tier::Trusted, t.trusted_bps, loss_bps)
        } else {
            (Tier::Established, t.established_bps, loss_bps)
        }
    }

    fn lock_bps_for(&self, merchant: &AccountId) -> (Tier, u16) {
        let m = self.merchants.get(merchant).expect("Merchant not found");
        let (tier, tier_bps, _) = self.tier_of(m);
        (tier, tier_bps.max(m.min_lock_bps))
    }

    fn listing_view(&self, id: u32, listing: Listing) -> ListingView {
        let (tier, lock_bps) = self.lock_bps_for(&listing.merchant);
        let protected = listing.price.0 * lock_bps as u128 / BPS;
        let merchant_name = self
            .merchants
            .get(&listing.merchant)
            .map(|m| m.name.clone())
            .unwrap_or_default();
        ListingView {
            id,
            seller_now: U128(listing.price.0 - protected),
            protected: U128(protected),
            listing,
            merchant_name,
            tier,
            lock_bps,
        }
    }

    fn try_release(&mut self, token_id: &TokenId) -> bool {
        let Some(e) = self.escrows.get_mut(token_id) else {
            return false;
        };
        if e.status != Status::Locked || now_ms() < e.claim_ends {
            return false;
        }
        let amount = e.locked.0;
        let merchant = e.merchant.clone();
        e.status = Status::Settled;
        e.final_buyer_bps = Some(0);
        e.closed_at = Some(now_ms());
        self.credit(&merchant, amount);
        self.merchants.get_mut(&merchant).unwrap().finished += 1;
        event("released", format!("{{\"token_id\":\"{token_id}\"}}"));
        true
    }

    /// Pays out a final decision and updates the merchant's record.
    fn execute(&mut self, token_id: &TokenId, buyer_bps: u16) {
        let holder = self.holder(token_id);
        let e = self.escrows.get_mut(token_id).expect("Receipt not found");
        require!(!e.status.is_final(), "Already final");
        let locked = e.locked.0;
        let to_buyer = locked * buyer_bps as u128 / BPS;
        let to_merchant = locked - to_buyer;
        let merchant = e.merchant.clone();
        let claimant = e.claim.as_ref().map(|c| c.claimant.clone());
        e.status = match buyer_bps {
            10_000 => Status::Refunded,
            0 => Status::Settled,
            _ => Status::Split,
        };
        e.final_buyer_bps = Some(buyer_bps);
        e.closed_at = Some(now_ms());
        self.credit(&holder, to_buyer);
        self.credit(&merchant, to_merchant);
        let m = self.merchants.get_mut(&merchant).unwrap();
        m.finished += 1;
        if buyer_bps >= 5_000 {
            m.lost += 1;
        }
        if let Some(c) = claimant {
            if buyer_bps >= 5_000 {
                self.record_buyer(&c, |r| r.won += 1);
            } else {
                self.record_buyer(&c, |r| r.lost += 1);
            }
        }
        event(
            "decided",
            format!(
                "{{\"token_id\":\"{token_id}\",\"buyer_bps\":{buyer_bps},\"holder\":\"{holder}\"}}"
            ),
        );
    }

    fn assert_transferable(&self, token_id: &TokenId) {
        if let Some(e) = self.escrows.get(token_id) {
            require!(
                !e.status.blocks_transfer(),
                "Receipts can't be transferred during a dispute"
            );
        }
    }
}

// ---------------------------------------------------------------- payments

#[near]
impl FungibleTokenReceiver for Recourse {
    /// Runs when USDC arrives via ft_transfer_call. `msg` is
    /// `{"listing_id": 0}` from a buyer, or `{"listing_id": 0, "buyer": "x.testnet"}`
    /// from the relayer. Any panic here makes the token contract refund the
    /// full amount to the sender.
    fn ft_on_transfer(
        &mut self,
        sender_id: AccountId,
        amount: U128,
        msg: String,
    ) -> PromiseOrValue<U128> {
        require!(
            env::predecessor_account_id() == self.config.token,
            "Only the accepted token"
        );
        let pay: PayMsg = near_sdk::serde_json::from_str(&msg)
            .unwrap_or_else(|_| env::panic_str("Invalid msg"));
        let buyer = if sender_id == self.config.relayer {
            pay.buyer.unwrap_or_else(|| env::panic_str("Relayer must name the buyer"))
        } else {
            if let Some(b) = &pay.buyer {
                require!(*b == sender_id, "Buyer must be the sender");
            }
            sender_id
        };

        let listing = self
            .listings
            .get(pay.listing_id)
            .unwrap_or_else(|| env::panic_str("Listing not found"))
            .clone();
        require!(listing.active, "Listing is not active");
        require!(amount.0 == listing.price.0, "Amount must equal the price");
        require!(buyer != listing.merchant, "Merchants can't buy their own listing");
        self.assert_approved(&listing.merchant);

        let (_, lock_bps) = self.lock_bps_for(&listing.merchant);
        let locked = listing.price.0 * lock_bps as u128 / BPS;
        let seller_now = listing.price.0 - locked;

        self.charge_storage(&listing.merchant, STORAGE_RECEIPT);
        self.credit(&listing.merchant, seller_now);

        let now = now_ms();
        let token_id: TokenId = self.next_receipt.to_string();
        self.next_receipt += 1;
        let claim_ends = now + listing.claim_window_ms;

        let metadata = TokenMetadata {
            title: Some(format!("Recourse receipt #{token_id}: {}", listing.title)),
            description: Some(format!(
                "{} protected until {} (ms). Refund rights belong to the holder of this receipt.",
                locked, claim_ends
            )),
            media: listing.image.as_ref().map(|i| {
                if i.starts_with('/') {
                    format!("{SITE_URL}{i}")
                } else {
                    i.clone()
                }
            }),
            media_hash: None,
            copies: Some(1),
            issued_at: Some(now.to_string()),
            expires_at: None,
            starts_at: None,
            updated_at: None,
            extra: None,
            reference: None,
            reference_hash: None,
        };
        self.tokens
            .internal_mint_with_refund(token_id.clone(), buyer.clone(), Some(metadata), None);
        // The standard NEP-171 mint event, so wallets and explorers index the
        // receipt with its owner and picture.
        NftMint {
            owner_id: &buyer,
            token_ids: &[&token_id],
            memo: None,
        }
        .emit();

        self.escrows.insert(
            token_id.clone(),
            Escrow {
                listing_id: pay.listing_id,
                merchant: listing.merchant.clone(),
                original_buyer: buyer.clone(),
                price: listing.price,
                locked: U128(locked),
                lock_bps,
                paid_at: now,
                claim_ends,
                status: if locked == 0 { Status::Settled } else { Status::Locked },
                claim: None,
                ruling: None,
                review: None,
                final_buyer_bps: if locked == 0 { Some(0) } else { None },
                closed_at: if locked == 0 { Some(now) } else { None },
                extended: false,
            },
        );
        if let Some(l) = self.listings.get_mut(pay.listing_id) {
            l.sold += 1;
        }
        let merchant = listing.merchant.clone();
        match self.merchant_receipts.get_mut(&merchant) {
            Some(ids) => ids.push(token_id.clone()),
            None => {
                self.merchant_receipts.insert(merchant, vec![token_id.clone()]);
            }
        }
        event(
            "purchased",
            format!(
                "{{\"token_id\":\"{token_id}\",\"listing_id\":{},\"buyer\":\"{buyer}\",\"locked\":\"{locked}\"}}",
                pay.listing_id
            ),
        );
        PromiseOrValue::Value(U128(0))
    }
}

// ---------------------------------------------------------------- NFT standard

#[near]
impl NonFungibleTokenCore for Recourse {
    #[payable]
    fn nft_transfer(
        &mut self,
        receiver_id: AccountId,
        token_id: TokenId,
        approval_id: Option<u64>,
        memo: Option<String>,
    ) {
        self.assert_transferable(&token_id);
        self.tokens
            .nft_transfer(receiver_id, token_id, approval_id, memo)
    }

    #[payable]
    fn nft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        token_id: TokenId,
        approval_id: Option<u64>,
        memo: Option<String>,
        msg: String,
    ) -> PromiseOrValue<bool> {
        self.assert_transferable(&token_id);
        self.tokens
            .nft_transfer_call(receiver_id, token_id, approval_id, memo, msg)
    }

    fn nft_token(&self, token_id: TokenId) -> Option<Token> {
        self.tokens.nft_token(token_id)
    }
}

#[near]
impl NonFungibleTokenResolver for Recourse {
    #[private]
    fn nft_resolve_transfer(
        &mut self,
        previous_owner_id: AccountId,
        receiver_id: AccountId,
        token_id: TokenId,
        approved_account_ids: Option<HashMap<AccountId, u64>>,
    ) -> bool {
        self.tokens.nft_resolve_transfer(
            previous_owner_id,
            receiver_id,
            token_id,
            approved_account_ids,
        )
    }
}

#[near]
impl NonFungibleTokenEnumeration for Recourse {
    fn nft_total_supply(&self) -> U128 {
        self.tokens.nft_total_supply()
    }

    fn nft_tokens(&self, from_index: Option<U128>, limit: Option<u64>) -> Vec<Token> {
        self.tokens.nft_tokens(from_index, limit)
    }

    fn nft_supply_for_owner(&self, account_id: AccountId) -> U128 {
        self.tokens.nft_supply_for_owner(account_id)
    }

    fn nft_tokens_for_owner(
        &self,
        account_id: AccountId,
        from_index: Option<U128>,
        limit: Option<u64>,
    ) -> Vec<Token> {
        self.tokens
            .nft_tokens_for_owner(account_id, from_index, limit)
    }
}

#[near]
impl NonFungibleTokenMetadataProvider for Recourse {
    fn nft_metadata(&self) -> NFTContractMetadata {
        NFTContractMetadata {
            spec: NFT_METADATA_SPEC.to_string(),
            name: "Recourse Receipts".to_string(),
            symbol: "RCPT".to_string(),
            icon: None,
            base_uri: Some(SITE_URL.to_string()),
            reference: None,
            reference_hash: None,
        }
    }
}

#[cfg(test)]
mod tests;
