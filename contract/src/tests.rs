use super::*;
use near_sdk::test_utils::VMContextBuilder;
use near_sdk::{testing_env, NearToken};

const USDC: u128 = 1_000_000; // 6 decimals
const MIN: u64 = 60_000;

fn acc(name: &str) -> AccountId {
    name.parse().unwrap()
}
fn owner() -> AccountId {
    acc("owner.testnet")
}
fn judge() -> AccountId {
    acc("judge.testnet")
}
fn relayer() -> AccountId {
    acc("relayer.testnet")
}
fn token() -> AccountId {
    acc("usdc.testnet")
}
fn shop() -> AccountId {
    acc("shop.testnet")
}
fn buyer() -> AccountId {
    acc("buyer.testnet")
}
fn buyer2() -> AccountId {
    acc("buyer2.testnet")
}

/// Sets the caller and the clock (milliseconds).
fn ctx(caller: AccountId, now_ms: u64, deposit: u128) {
    let mut b = VMContextBuilder::new();
    b.current_account_id(acc("recourse.testnet"))
        .predecessor_account_id(caller.clone())
        .signer_account_id(caller)
        .block_timestamp(now_ms * 1_000_000)
        .attached_deposit(NearToken::from_yoctonear(deposit));
    testing_env!(b.build());
}

/// Contract with an approved shop and one 100 USDC listing (7-minute window).
fn setup() -> Recourse {
    ctx(owner(), 1_000, 0);
    let mut c = Recourse::new(
        owner(),
        judge(),
        relayer(),
        token(),
        3 * MIN,
        3 * MIN,
        10 * MIN,
    );
    ctx(shop(), 1_000, 1_000_000_000_000_000_000_000_000); // 1 NEAR
    c.register_merchant("Demo Shop".into());
    ctx(owner(), 1_000, 0);
    c.approve_merchant(shop());
    ctx(shop(), 1_000, 0);
    let id = c.create_listing(
        "Leather tote".into(),
        "Hand-stitched tote bag".into(),
        None,
        U128(100 * USDC),
        7 * MIN,
    );
    assert_eq!(id, 0);
    c
}

/// Buyer pays 100 USDC at time `at`; returns the receipt id.
fn buy(c: &mut Recourse, who: AccountId, at: u64) -> TokenId {
    ctx(token(), at, 0);
    let _ = c.ft_on_transfer(who, U128(100 * USDC), "{\"listing_id\":0}".into());
    (c.next_receipt - 1).to_string()
}

fn status(c: &Recourse, id: &TokenId) -> Status {
    c.get_receipt(id.clone()).unwrap().escrow.status
}

#[test]
fn new_seller_payment_is_split_50_50() {
    let mut c = setup();
    let id = buy(&mut c, buyer(), 2_000);
    let r = c.get_receipt(id.clone()).unwrap();
    assert_eq!(r.holder, buyer());
    assert_eq!(r.escrow.locked.0, 50 * USDC);
    assert_eq!(r.escrow.status, Status::Locked);
    assert_eq!(c.get_balance(shop()).0, 50 * USDC);
    assert_eq!(c.nft_token(id).unwrap().owner_id, buyer());
}

#[test]
#[should_panic(expected = "Amount must equal the price")]
fn wrong_amount_is_rejected() {
    let mut c = setup();
    ctx(token(), 2_000, 0);
    let _ = c.ft_on_transfer(buyer(), U128(99 * USDC), "{\"listing_id\":0}".into());
}

#[test]
#[should_panic(expected = "Only the accepted token")]
fn other_tokens_are_rejected() {
    let mut c = setup();
    ctx(acc("fake.testnet"), 2_000, 0);
    let _ = c.ft_on_transfer(buyer(), U128(100 * USDC), "{\"listing_id\":0}".into());
}

#[test]
fn relayer_pays_on_behalf_of_buyer() {
    let mut c = setup();
    ctx(token(), 2_000, 0);
    let _ = c.ft_on_transfer(
        relayer(),
        U128(100 * USDC),
        "{\"listing_id\":0,\"buyer\":\"buyer.testnet\"}".into(),
    );
    assert_eq!(c.get_receipt("1".into()).unwrap().holder, buyer());
}

#[test]
#[should_panic(expected = "Merchant is not approved")]
fn pending_merchant_cannot_sell() {
    let mut c = setup();
    ctx(acc("other.testnet"), 1_000, 1_000_000_000_000_000_000_000_000);
    c.register_merchant("Other".into());
    c.create_listing("X".into(), "Y".into(), None, U128(USDC), MIN);
}

#[test]
#[should_panic(expected = "Only the owner")]
fn merchant_cannot_approve_itself() {
    let mut c = setup();
    ctx(acc("other.testnet"), 1_000, 1_000_000_000_000_000_000_000_000);
    c.register_merchant("Other".into());
    c.approve_merchant(acc("other.testnet"));
}

#[test]
#[should_panic(expected = "Merchant already registered")]
fn merchant_cannot_reregister_to_reset_record() {
    let mut c = setup();
    ctx(shop(), 1_000, 1_000_000_000_000_000_000_000_000);
    c.register_merchant("Fresh start".into());
}

#[test]
fn merchant_can_raise_but_not_lower_lock_rate() {
    let mut c = setup();
    ctx(shop(), 1_000, 0);
    c.set_min_lock_bps(1_000); // below the New tier's 50%
    assert_eq!(c.get_merchant(shop()).unwrap().lock_bps, 5_000);
    c.set_min_lock_bps(8_000);
    assert_eq!(c.get_merchant(shop()).unwrap().lock_bps, 8_000);
}

#[test]
fn release_after_window_pays_merchant() {
    let mut c = setup();
    let id = buy(&mut c, buyer(), 2_000);
    ctx(acc("anyone.testnet"), 2_000 + 7 * MIN - 1, 0);
    assert_eq!(c.release_many(vec![id.clone()]), 0);
    ctx(acc("anyone.testnet"), 2_000 + 7 * MIN, 0);
    c.release(id.clone());
    assert_eq!(status(&c, &id), Status::Settled);
    assert_eq!(c.get_balance(shop()).0, 100 * USDC);
    assert_eq!(c.get_merchant(shop()).unwrap().merchant.finished, 1);
}

#[test]
fn ruling_funds_stay_locked_until_appeal_window_closes() {
    let mut c = setup();
    let id = buy(&mut c, buyer(), 2_000);
    ctx(buyer(), 3_000, 0);
    c.open_claim(id.clone(), "not_delivered".into(), "hash-b".into(), "ct".into());
    ctx(shop(), 4_000, 0);
    c.respond(id.clone(), "hash-m".into(), "ct-m".into());
    ctx(judge(), 5_000, 0);
    c.post_ruling(id.clone(), 10_000, "ruling".into(), "att-1".into(), "{}".into());
    assert_eq!(status(&c, &id), Status::Ruled);
    // Nothing credited to the buyer yet.
    assert_eq!(c.get_balance(buyer()).0, 0);
    ctx(acc("anyone.testnet"), 5_000 + 3 * MIN, 0);
    c.finalize(id.clone());
    assert_eq!(status(&c, &id), Status::Refunded);
    assert_eq!(c.get_balance(buyer()).0, 50 * USDC);
    let m = c.get_merchant(shop()).unwrap().merchant;
    assert_eq!((m.finished, m.lost), (1, 1));
}

#[test]
#[should_panic(expected = "Appeal window still open")]
fn cannot_finalize_inside_appeal_window() {
    let mut c = setup();
    let id = buy(&mut c, buyer(), 2_000);
    ctx(buyer(), 3_000, 0);
    c.open_claim(id.clone(), "not_delivered".into(), "hash-b".into(), "ct".into());
    ctx(shop(), 4_000, 0);
    c.respond(id.clone(), "hash-m".into(), "ct-m".into());
    ctx(judge(), 5_000, 0);
    c.post_ruling(id.clone(), 10_000, "ruling".into(), "att-1".into(), "{}".into());
    ctx(buyer(), 6_000, 0);
    c.finalize(id);
}

#[test]
fn appeal_goes_to_human_and_is_final() {
    let mut c = setup();
    let id = buy(&mut c, buyer(), 2_000);
    ctx(buyer(), 3_000, 0);
    c.open_claim(id.clone(), "not_as_described".into(), "hash-b".into(), "ct".into());
    ctx(shop(), 4_000, 0);
    c.respond(id.clone(), "hash-m".into(), "ct-m".into());
    ctx(judge(), 5_000, 0);
    c.post_ruling(id.clone(), 10_000, "ruling".into(), "att-1".into(), "{}".into());
    ctx(shop(), 6_000, 0);
    c.appeal(id.clone(), "Item was as described".into());
    assert_eq!(status(&c, &id), Status::Appealed);
    ctx(owner(), 7_000, 0);
    c.resolve_review(id.clone(), 4_000, "note".into(), "Split after review".into());
    assert_eq!(status(&c, &id), Status::Split);
    assert_eq!(c.get_balance(buyer()).0, 20 * USDC);
    assert_eq!(c.get_balance(shop()).0, 80 * USDC);
    // A 40% buyer share is not a merchant loss.
    assert_eq!(c.get_merchant(shop()).unwrap().merchant.lost, 0);
}

#[test]
fn unanswered_review_refunds_holder() {
    let mut c = setup();
    let id = buy(&mut c, buyer(), 2_000);
    ctx(buyer(), 3_000, 0);
    c.open_claim(id.clone(), "damaged".into(), "hash-b".into(), "ct".into());
    ctx(shop(), 4_000, 0);
    c.respond(id.clone(), "hash-m".into(), "ct-m".into());
    ctx(judge(), 5_000, 0);
    c.flag_for_review(id.clone(), "Runs disagreed".into());
    assert_eq!(status(&c, &id), Status::UnderReview);
    ctx(acc("anyone.testnet"), 5_000 + 10 * MIN, 0);
    c.review_timeout(id.clone());
    assert_eq!(status(&c, &id), Status::Refunded);
    assert_eq!(c.get_balance(buyer()).0, 50 * USDC);
}

#[test]
fn silent_merchant_loses_by_default() {
    let mut c = setup();
    let id = buy(&mut c, buyer(), 2_000);
    ctx(buyer(), 3_000, 0);
    c.open_claim(id.clone(), "not_delivered".into(), "hash-b".into(), "ct".into());
    ctx(acc("anyone.testnet"), 3_000 + 3 * MIN, 0);
    c.default_judgment(id.clone());
    assert_eq!(status(&c, &id), Status::Refunded);
    assert_eq!(c.get_balance(buyer()).0, 50 * USDC);
}

#[test]
fn resold_receipt_refunds_new_holder() {
    let mut c = setup();
    let id = buy(&mut c, buyer(), 2_000);
    ctx(buyer(), 3_000, 1);
    c.nft_transfer(buyer2(), id.clone(), None, None);
    ctx(buyer2(), 4_000, 0);
    c.open_claim(id.clone(), "damaged".into(), "hash-b2".into(), "ct".into());
    ctx(acc("anyone.testnet"), 4_000 + 3 * MIN, 0);
    c.default_judgment(id.clone());
    assert_eq!(c.get_balance(buyer2()).0, 50 * USDC);
    assert_eq!(c.get_balance(buyer()).0, 0);
}

#[test]
#[should_panic(expected = "Only the receipt holder")]
fn previous_owner_cannot_claim_after_resale() {
    let mut c = setup();
    let id = buy(&mut c, buyer(), 2_000);
    ctx(buyer(), 3_000, 1);
    c.nft_transfer(buyer2(), id.clone(), None, None);
    ctx(buyer(), 4_000, 0);
    c.open_claim(id, "damaged".into(), "hash".into(), "ct".into());
}

#[test]
#[should_panic(expected = "Receipts can't be transferred during a dispute")]
fn no_transfer_during_dispute() {
    let mut c = setup();
    let id = buy(&mut c, buyer(), 2_000);
    ctx(buyer(), 3_000, 0);
    c.open_claim(id.clone(), "damaged".into(), "hash".into(), "ct".into());
    ctx(buyer(), 4_000, 1);
    c.nft_transfer(buyer2(), id, None, None);
}

#[test]
#[should_panic(expected = "Claim window has ended")]
fn no_claims_after_window() {
    let mut c = setup();
    let id = buy(&mut c, buyer(), 2_000);
    ctx(buyer(), 2_000 + 7 * MIN, 0);
    c.open_claim(id, "damaged".into(), "hash".into(), "ct".into());
}

#[test]
#[should_panic(expected = "Already final")]
fn no_double_settlement() {
    let mut c = setup();
    let id = buy(&mut c, buyer(), 2_000);
    ctx(buyer(), 3_000, 0);
    c.open_claim(id.clone(), "not_delivered".into(), "hash".into(), "ct".into());
    ctx(acc("anyone.testnet"), 3_000 + 3 * MIN, 0);
    c.default_judgment(id.clone());
    ctx(owner(), 3_000 + 3 * MIN, 0);
    c.execute(&id, 0);
}

#[test]
fn tiers_use_finished_orders_as_denominator() {
    let mut c = setup();
    // 30 clean finished orders and 1 lost dispute: Trusted, not Flagged.
    {
        let m = c.merchants.get_mut(&shop()).unwrap();
        m.finished = 31;
        m.lost = 1;
    }
    let v = c.get_merchant(shop()).unwrap();
    assert_eq!(v.tier, Tier::Trusted);
    assert_eq!(v.loss_bps, 322);
    // 3 losses out of 10: Flagged, everything locked.
    {
        let m = c.merchants.get_mut(&shop()).unwrap();
        m.finished = 10;
        m.lost = 3;
    }
    let v = c.get_merchant(shop()).unwrap();
    assert_eq!(v.tier, Tier::Flagged);
    assert_eq!(v.lock_bps, 10_000);
    // Zero history: New, no division.
    {
        let m = c.merchants.get_mut(&shop()).unwrap();
        m.finished = 0;
        m.lost = 0;
    }
    assert_eq!(c.get_merchant(shop()).unwrap().tier, Tier::New);
}

#[test]
fn evidence_is_stored_per_side() {
    let mut c = setup();
    let id = buy(&mut c, buyer(), 2_000);
    ctx(buyer(), 3_000, 0);
    c.open_claim(id.clone(), "damaged".into(), "hash-b".into(), "buyer-ciphertext".into());
    ctx(shop(), 4_000, 0);
    c.respond(id.clone(), "hash-m".into(), "merchant-ciphertext".into());
    let (b, m) = c.get_evidence(id);
    assert_eq!(b.as_deref(), Some("buyer-ciphertext"));
    assert_eq!(m.as_deref(), Some("merchant-ciphertext"));
}

#[test]
fn holder_can_extend_window_once() {
    let mut c = setup();
    let id = buy(&mut c, buyer(), 2_000);
    ctx(buyer(), 3_000, 0);
    c.extend_window(id.clone());
    let r = c.get_receipt(id.clone()).unwrap();
    assert_eq!(r.escrow.claim_ends, 2_000 + 14 * MIN);
    assert!(r.escrow.extended);
    // The original window has passed, but the extension keeps claims open.
    ctx(buyer(), 2_000 + 10 * MIN, 0);
    c.open_claim(id.clone(), "not_delivered".into(), "h".into(), "ct".into());
    assert_eq!(status(&c, &id), Status::Disputed);
}

#[test]
#[should_panic(expected = "The window can only be extended once")]
fn window_extends_only_once() {
    let mut c = setup();
    let id = buy(&mut c, buyer(), 2_000);
    ctx(buyer(), 3_000, 0);
    c.extend_window(id.clone());
    c.extend_window(id);
}

#[test]
#[should_panic(expected = "Only the receipt holder")]
fn seller_cannot_extend_window() {
    let mut c = setup();
    let id = buy(&mut c, buyer(), 2_000);
    ctx(shop(), 3_000, 0);
    c.extend_window(id);
}

#[test]
fn release_waits_for_extended_window() {
    let mut c = setup();
    let id = buy(&mut c, buyer(), 2_000);
    ctx(buyer(), 3_000, 0);
    c.extend_window(id.clone());
    ctx(shop(), 2_000 + 8 * MIN, 0);
    assert_eq!(c.release_many(vec![id.clone()]), 0);
    ctx(shop(), 2_000 + 14 * MIN, 0);
    assert_eq!(c.release_many(vec![id.clone()]), 1);
}

#[test]
fn buyer_record_counts_claims_won_and_lost() {
    let mut c = setup();
    // Won: the seller stays silent.
    let a = buy(&mut c, buyer(), 2_000);
    ctx(buyer(), 3_000, 0);
    c.open_claim(a.clone(), "not_delivered".into(), "h".into(), "ct".into());
    ctx(acc("anyone.testnet"), 3_000 + 3 * MIN, 0);
    c.default_judgment(a);
    // Lost: the AI rules for the seller and nobody appeals.
    let b = buy(&mut c, buyer(), 4_000);
    ctx(buyer(), 5_000, 0);
    c.open_claim(b.clone(), "not_delivered".into(), "h".into(), "ct".into());
    ctx(shop(), 6_000, 0);
    c.respond(b.clone(), "hm".into(), "ct".into());
    ctx(judge(), 7_000, 0);
    c.post_ruling(b.clone(), 0, "rh".into(), "att".into(), "{}".into());
    ctx(acc("anyone.testnet"), 7_000 + 3 * MIN, 0);
    c.finalize(b);
    let r = c.get_buyer(buyer());
    assert_eq!((r.claims, r.won, r.lost), (2, 1, 1));
    assert_eq!(c.get_buyer(buyer2()).claims, 0);
}
