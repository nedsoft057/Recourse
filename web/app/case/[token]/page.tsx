import Link from "next/link";
import { notFound } from "next/navigation";
import { view, CONTRACT, EXPLORER } from "@/lib/chain";
import { openEvidence, sha256 } from "@/lib/evidence";
import { accountOf, currentPerson, personByAccount } from "@/lib/identity";
import { usdc } from "@/lib/format";
import { statusFor } from "@/lib/status";
import type { BuyerRecord, ListingView, ReceiptView } from "@/lib/types";
import { Thumb } from "@/components/Thumb";
import { Seal } from "@/components/Seal";
import { When, Countdown } from "@/components/When";
import { CaseActions, type CaseMode } from "./CaseActions";

export const dynamic = "force-dynamic";

const reasonWords: Record<string, string> = {
  not_delivered: "Not delivered",
  not_as_described: "Not as described",
  damaged: "Arrived damaged",
};

const decisionWords = (bps: number) =>
  bps === 10_000 ? "Refund the buyer in full" : bps === 0 ? "Release to the seller" : `Split: ${bps / 100}% back to the buyer`;

function parseDetails(details: string | undefined) {
  try {
    return details ? JSON.parse(details) : null;
  } catch {
    return null;
  }
}

export default async function CasePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^\d+$/.test(token)) notFound();
  const r = await view<ReceiptView | null>("get_receipt", { token_id: token });
  if (!r) notFound();
  const e = r.escrow;
  const [listing, evidence] = await Promise.all([
    view<ListingView | null>("get_listing", { listing_id: e.listing_id }),
    view<[string | null, string | null]>("get_evidence", { token_id: token }),
  ]);
  const record = e.claim ? await view<BuyerRecord>("get_buyer", { account_id: e.claim.claimant }) : null;
  const me = await currentPerson();
  const mine = accountOf(me.key);
  const isHolder = r.holder === mine;
  const isMerchant = e.merchant === mine;
  const isReviewer = me.role === "reviewer";
  const canSeeEvidence = isHolder || isMerchant || isReviewer || e.claim?.claimant === mine;
  const now = Date.now();
  const s = statusFor(e, now);
  const name = (acc: string) => personByAccount(acc)?.name || acc;
  const seller = listing?.merchant_name || name(e.merchant);

  // Which action panel this viewer gets right now.
  let mode: CaseMode = { kind: "none" };
  if (e.status === "Locked" && now < e.claim_ends && isHolder) mode = { kind: "claim" };
  else if (e.status === "Disputed" && !e.claim?.responded_at) {
    if (now >= e.claim!.response_due && (isHolder || isMerchant || isReviewer)) mode = { kind: "default" };
    else if (isMerchant) mode = { kind: "respond" };
    else mode = { kind: "waiting", text: `Waiting for ${seller} to respond.` };
  } else if (e.status === "Disputed") mode = { kind: "judge" };
  else if (e.status === "Ruled" && e.ruling) {
    if (now >= e.ruling.appeal_ends) mode = { kind: "finalize" };
    else if (isHolder || isMerchant) mode = { kind: "appeal" };
  } else if ((e.status === "UnderReview" || e.status === "Appealed") && e.review) {
    if (now >= e.review.deadline) mode = { kind: "timeout" };
    else if (isReviewer) mode = { kind: "resolve" };
    else mode = { kind: "waiting", text: "A human reviewer is looking at this case." };
  }

  const details = parseDetails(e.ruling?.details);
  const ai = e.ruling && !e.ruling.by_human ? details : null;
  const recomputed =
    ai && e.claim
      ? sha256(JSON.stringify({ token_id: token, buyer_evidence: e.claim.buyer_evidence, merchant_evidence: e.claim.merchant_evidence, ruling: ai.ruling }))
      : null;
  const buyerEv = canSeeEvidence ? openEvidence(evidence[0]) : null;
  const sellerEv = canSeeEvidence ? openEvidence(evidence[1]) : null;

  return (
    <div className="narrow" style={{ maxWidth: "40rem", padding: "2rem var(--gutter) 4rem", display: "grid", gap: "1rem" }}>
      <div className="card" style={{ padding: "1rem", display: "grid", gridTemplateColumns: "5rem 1fr", gap: "1rem", alignItems: "center" }}>
        <Thumb image={listing?.listing.image} title={r.listing_title} className="case-thumb" />
        <div style={{ display: "grid", gap: "0.2rem" }}>
          <span className="small muted">
            Receipt NFT #{token} from {seller}, held by {name(r.holder)}.{" "}
            <a href={`${EXPLORER}/nft-token/${CONTRACT}/${token}`} target="_blank" rel="noreferrer">View NFT</a>
          </span>
          <h1 style={{ fontSize: "1.9rem", lineHeight: 1.05 }}>{r.listing_title}</h1>
          <span className={`receipt-status ${s.held ? "held" : ""}`}>
            {s.held && <Seal size={16} on="light" />} {s.title}
          </span>
          <span className="small muted">
            Paid {usdc(e.price)} USDC, {usdc(e.locked)} held. Held by {name(r.holder)}
            {r.holder !== e.original_buyer ? `, bought by ${name(e.original_buyer)}` : ""}.
          </span>
        </div>
      </div>

      <section className="card" style={{ padding: "1rem 1.1rem" }} aria-label="What has happened">
        <ol className="case-timeline">
          <li>
            <strong>Paid</strong> <When ms={e.paid_at} />
            <span className="muted"> Claim window until <When ms={e.claim_ends} />{e.extended ? " (extended once by the buyer)" : ""}</span>
          </li>
          {e.claim && (
            <li>
              <strong>Claim opened: {reasonWords[e.claim.reason] || e.claim.reason}</strong> by {name(e.claim.claimant)},{" "}
              <When ms={e.claim.opened_at} />
              {record && (
                <span className="muted">
                  {" "}
                  {name(e.claim.claimant)}&apos;s claim record:{" "}
                  {record.claims <= 1 && record.won + record.lost === 0
                    ? "first claim"
                    : `${record.claims} opened, ${record.won} won, ${record.lost} rejected`}
                </span>
              )}
            </li>
          )}
          {e.claim &&
            (e.claim.responded_at ? (
              <li>
                <strong>{seller} responded</strong> <When ms={e.claim.responded_at} />
              </li>
            ) : (
              e.status === "Disputed" && (
                <li>
                  <strong>Seller's response due</strong> <When ms={e.claim.response_due} /> (<Countdown ms={e.claim.response_due} />)
                </li>
              )
            ))}
          {e.review && (
            <li>
              <strong>{e.review.kind === "Appeal" ? `Appealed by ${name(e.review.requested_by)}` : "Sent to a human reviewer"}</strong>{" "}
              <When ms={e.review.started_at} />
              <span className="muted"> {e.review.reason}</span>
            </li>
          )}
          {e.ruling && (
            <li>
              <strong>
                {e.ruling.by_human ? "Reviewer decided" : "AI judge ruled"}: {decisionWords(e.ruling.buyer_bps)}
              </strong>{" "}
              <When ms={e.ruling.ruled_at} />
              {!e.ruling.by_human && e.status === "Ruled" && (
                <span className="muted">
                  {" "}Money stays held until the appeal window closes <When ms={e.ruling.appeal_ends} /> (<Countdown ms={e.ruling.appeal_ends} />)
                </span>
              )}
            </li>
          )}
          {e.closed_at && (
            <li>
              <strong>Closed</strong> <When ms={e.closed_at} />
            </li>
          )}
        </ol>
      </section>

      <CaseActions tokenId={token} mode={mode} seller={seller} held={usdc(e.locked)} />

      {e.ruling && (
        <section className="dark-card" aria-label="The ruling">
          <h3 style={{ fontSize: "1.5rem" }}>{e.ruling.by_human ? "Reviewer's decision" : "The AI judge's ruling"}</h3>
          <p style={{ color: "#fff", fontWeight: 600 }}>{decisionWords(e.ruling.buyer_bps)}</p>
          {ai ? (
            <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: "0.3rem", color: "rgba(255,255,255,0.78)" }}>
              {ai.ruling.reasons.map((x: string) => <li key={x}>{x}</li>)}
            </ul>
          ) : (
            <p>{e.ruling.details}</p>
          )}
          {ai && (
            <div className="verify">
              <p className="small">Verify this ruling</p>
              <dl>
                <dt>Model</dt><dd>{ai.model}, run twice inside a NEAR AI Cloud TEE (second run: {ai.second_run?.decision})</dd>
                <dt>Ruling hash on-chain</dt><dd>{e.ruling.ruling_hash}</dd>
                <dt>Recomputed from the evidence and ruling</dt>
                <dd>{recomputed === e.ruling.ruling_hash ? "Matches" : "Does not match"}</dd>
                <dt>Chat ID</dt><dd>{ai.chat_id || "none"}</dd>
                <dt>Enclave signing address</dt><dd>{ai.signature?.signing_address || "signature not returned"}</dd>
              </dl>
              <p className="small">
                Check the signature against the model's attestation report from NEAR AI Cloud
                (<code>/v1/attestation/report?model={ai.model}</code>) to confirm the answer came from a genuine enclave.
              </p>
            </div>
          )}
        </section>
      )}

      {canSeeEvidence && (buyerEv || sellerEv) && (
        <section className="card" style={{ padding: "1rem 1.1rem", display: "grid", gap: "0.9rem" }} aria-label="Evidence">
          <p className="small muted">
            Evidence is stored on-chain encrypted. Only the buyer, the seller, the reviewer and the AI judge can read it.
          </p>
          {buyerEv && (
            <div>
              <p className="label">From {name(e.claim!.claimant)}</p>
              <p>{buyerEv.statement}</p>
              {buyerEv.photo && <a href={buyerEv.photo} target="_blank" rel="noreferrer">Photo</a>}
            </div>
          )}
          {sellerEv && (
            <div>
              <p className="label">From {seller}</p>
              <p>{sellerEv.statement}</p>
              {sellerEv.photo && <a href={sellerEv.photo} target="_blank" rel="noreferrer">Photo</a>}
            </div>
          )}
        </section>
      )}

      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
        <Link className="button quiet" href={isMerchant ? "/sell" : isReviewer ? "/review" : "/purchases"}>Back</Link>
      </div>
    </div>
  );
}
