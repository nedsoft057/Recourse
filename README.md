# Recourse

Buyer protection for stablecoin payments that travels with the item.

When you pay for something through Recourse, part of your payment goes to the seller right away and the rest stays locked in a **receipt NFT** that you hold. If the order goes wrong, you claim and get the locked part back. If you resell the item, you pass the receipt on, and the remaining protection goes with it.

Built for NEAR HACKATHON, track: **NFTs That Do Something**.

> Status: work in progress. Contract live on testnet; storefront live; dispute engine and full run-through steps coming next.

## What it is, honestly

Under the hood this is escrow of the buyer's own payment; the seller deposits nothing. What escrow doesn't have, and Recourse does:

- **Portable protection:** refund rights belong to whoever holds the receipt NFT.
- **Seller reputation:** a seller's record sets how much of each payment is locked (50% for new sellers down to 15% for trusted ones, 100% for flagged ones).
- **A defined dispute process:** claim, merchant response, AI ruling inside a NEAR AI Cloud enclave, a locked appeal window, and human review when the AI can't rule.

## Repo layout

- `contract/`: the Recourse contract (Rust, near-sdk 5). Receipts are NEP-171 NFTs; payments arrive as NEP-141 `ft_transfer_call`.
- `token/`: a standard NEP-141 test token (6 decimals) used as USDC on testnet.
- `.github/workflows/`: builds and tests on every push.

## Contract rules in one screen

- Payment must equal the listing price exactly, or it's returned in full.
- Only sellers approved by the owner can list or be paid. Sellers can't change their status, re-register to reset their record, or set a lock rate below their tier.
- A ruling never moves money directly. Funds stay locked through the appeal window; `finalize` executes it afterwards.
- If a review or appeal isn't decided in time, `review_timeout` refunds the receipt holder, so funds can't be stuck.
- Receipts can't be transferred during a dispute.
- Payouts are credited to balances and claimed with `withdraw`, so a failed transfer never leaves an order half-settled.
- Seller loss rate = lost disputes ÷ finished orders. A seller with no finished orders is "New"; flagging needs at least 3 losses.

## Build and test

```
cargo test --workspace
cd contract && cargo near build non-reproducible-wasm
```

CI does both on every push; built `.wasm` files are attached to each run.
