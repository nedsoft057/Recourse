import { view } from "@/lib/chain";
import { openEvidence } from "@/lib/evidence";
import { readFile } from "@/lib/files";
import { accountOf, currentPerson } from "@/lib/identity";
import type { ReceiptView } from "@/lib/types";

// Streams one decrypted evidence file, only to the people who may see the case.
export async function GET(req: Request) {
  const u = new URL(req.url);
  const token = u.searchParams.get("token") || "";
  const side = u.searchParams.get("side") || "";
  const i = Number(u.searchParams.get("i"));
  if (!/^\d+$/.test(token) || !["buyer", "merchant", "appeal"].includes(side) || !Number.isInteger(i)) {
    return new Response("Bad request", { status: 400 });
  }
  const r = await view<ReceiptView | null>("get_receipt", { token_id: token });
  if (!r) return new Response("Not found", { status: 404 });
  const me = await currentPerson();
  const mine = accountOf(me.key);
  const allowed = me.role === "reviewer" || r.holder === mine || r.escrow.merchant === mine || r.escrow.claim?.claimant === mine;
  if (!allowed) return new Response("Only the buyer, the seller and the reviewer can open evidence.", { status: 403 });
  const sealed =
    side === "appeal"
      ? await view<string | null>("get_appeal_evidence", { token_id: token })
      : (await view<[string | null, string | null]>("get_evidence", { token_id: token }))[side === "buyer" ? 0 : 1];
  const ev = openEvidence(sealed);
  const a = ev?.files?.[i];
  if (!a) return new Response("Not found", { status: 404 });
  try {
    const data = await readFile(a);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": a.type,
        "Content-Disposition": `inline; filename="${a.name}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    return new Response((e as Error).message, { status: 502 });
  }
}
