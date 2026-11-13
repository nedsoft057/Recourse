import { NextResponse } from "next/server";
import { act, cleanError } from "@/lib/chain";
import { sealEvidence, sha256 } from "@/lib/evidence";
import { accountOf, currentPerson } from "@/lib/identity";
import { judge } from "@/lib/judge";

// Two judge runs plus the on-chain write can take a while.
export const maxDuration = 60;

const REASONS = ["not_delivered", "not_as_described", "damaged"];

function evidenceFrom(body: any) {
  const statement = String(body.statement || "").trim();
  const photo = body.photo ? String(body.photo).trim() : null;
  if (statement.length < 10 || statement.length > 1500) {
    throw new Error("Describe what happened in 10 to 1,500 characters.");
  }
  if (photo && (!/^https:\/\//.test(photo) || photo.length > 300)) {
    throw new Error("Photo links must start with https://.");
  }
  return sealEvidence({ statement, photo });
}

export async function POST(req: Request) {
  const me = await currentPerson();
  const signer = accountOf(me.key);
  const body = await req.json();
  const token_id = String(body.token_id || "");
  if (!/^\d+$/.test(token_id)) return bad("Missing receipt number.");

  try {
    let out: Awaited<ReturnType<typeof act>> | null = null;
    let judged: { outcome: string; hash?: string } | null = null;

    switch (body.action) {
      case "open_claim": {
        if (!REASONS.includes(body.reason)) return bad("Choose what went wrong.");
        const ev = evidenceFrom(body);
        out = await act(signer, "open_claim", { token_id, reason: body.reason, evidence_hash: ev.hash, evidence: ev.sealed }, { tgas: 30n });
        break;
      }
      case "respond": {
        const ev = evidenceFrom(body);
        out = await act(signer, "respond", { token_id, evidence_hash: ev.hash, evidence: ev.sealed }, { tgas: 30n });
        if (!out.failures.length) judged = await judge(token_id);
        break;
      }
      case "judge":
        judged = await judge(token_id);
        break;
      case "default_judgment":
        out = await act(signer, "default_judgment", { token_id }, { tgas: 30n });
        break;
      case "appeal": {
        const reason = String(body.reason || "").trim();
        if (reason.length < 10 || reason.length > 280) return bad("Say why you're appealing in 10 to 280 characters.");
        out = await act(signer, "appeal", { token_id, reason }, { tgas: 30n });
        break;
      }
      case "finalize":
        out = await act(signer, "finalize", { token_id }, { tgas: 30n });
        break;
      case "review_timeout":
        out = await act(signer, "review_timeout", { token_id }, { tgas: 30n });
        break;
      case "resolve": {
        if (me.role !== "reviewer") return bad("Only the reviewer can decide a case.");
        const bps = Number(body.buyer_bps);
        if (!Number.isInteger(bps) || bps < 0 || bps > 10_000) return bad("Pick a decision.");
        const note = String(body.note || "").trim();
        if (note.length < 10 || note.length > 1000) return bad("Explain the decision in 10 to 1,000 characters.");
        out = await act(signer, "resolve_review", { token_id, buyer_bps: bps, note_hash: sha256(note), note }, { tgas: 30n });
        break;
      }
      default:
        return bad("Unknown action.");
    }

    if (out?.failures.length) return bad(cleanError(new Error(out.failures[0])));
    return NextResponse.json({ ok: true, hash: out?.hash, judged });
  } catch (e) {
    return bad(cleanError(e));
  }
}

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}
