import { NextResponse } from "next/server";
import { act, cleanError } from "@/lib/chain";
import { accountOf, currentPerson, PEOPLE } from "@/lib/identity";

// Actions the demo people can take. Each maps to one contract call, signed as
// the person currently selected. The contract enforces who may do what.
export async function POST(req: Request) {
  const me = await currentPerson();
  const body = await req.json();
  const signer = accountOf(me.key);
  try {
    let out;
    switch (body.action) {
      case "withdraw":
        out = await act(signer, "withdraw", {}, { deposit: 1n, tgas: 60n });
        break;
      case "pass_on": {
        const to = PEOPLE.find((p) => p.key === body.to && p.role === "buyer");
        if (!to || to.key === me.key) throw new Error("Choose someone else to pass it to.");
        out = await act(
          signer,
          "nft_transfer",
          { receiver_id: accountOf(to.key), token_id: String(body.token_id), memo: "Resold with the item" },
          { deposit: 1n, tgas: 30n }
        );
        break;
      }
      case "release":
        out = await act(signer, "release", { token_id: String(body.token_id) }, { tgas: 30n });
        break;
      case "release_many":
        out = await act(signer, "release_many", { token_ids: (body.token_ids || []).map(String) }, { tgas: 150n });
        break;
      case "refund":
        out = await act(signer, "refund", { token_id: String(body.token_id) }, { tgas: 30n });
        break;
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
    if (out.failures.length) {
      return NextResponse.json(
        { error: cleanError(new Error(out.failures[0])), hash: out.hash },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: true, hash: out.hash });
  } catch (e) {
    return NextResponse.json({ error: cleanError(e) }, { status: 400 });
  }
}
