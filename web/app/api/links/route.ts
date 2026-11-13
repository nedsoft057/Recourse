import { NextResponse } from "next/server";
import { act, cleanError } from "@/lib/chain";
import { accountOf, currentPerson } from "@/lib/identity";

const DAY = 86_400_000;
const ALLOWED_WINDOWS = [5 * 60_000, 3 * DAY, 7 * DAY, 14 * DAY];

export async function POST(req: Request) {
  const me = await currentPerson();
  if (me.role !== "seller") {
    return NextResponse.json({ error: "Switch to a seller to create a link." }, { status: 400 });
  }
  const body = await req.json();
  const title = String(body.title || "").trim();
  const description = String(body.description || "").trim();
  const image = body.image ? String(body.image).trim() : null;
  const price = String(body.price || "").trim();
  const window = Number(body.claim_window_ms);

  if (!title || title.length > 80) return bad("Give the item a name of up to 80 characters.");
  if (!description || description.length > 280) return bad("Add a description of up to 280 characters.");
  if (image && (!/^https:\/\//.test(image) || image.length > 256)) return bad("The photo link must start with https://.");
  if (!/^\d+(\.\d{1,2})?$/.test(price) || Number(price) <= 0) return bad("Enter a price like 120 or 19.99.");
  if (Number(price) > 10_000) return bad("Demo links are capped at 10,000 USDC.");
  if (!ALLOWED_WINDOWS.includes(window)) return bad("Pick one of the claim windows.");

  const [whole, frac = ""] = price.split(".");
  const raw = (BigInt(whole) * 1_000_000n + BigInt((frac + "000000").slice(0, 6))).toString();

  try {
    const out = await act(
      accountOf(me.key),
      "create_listing",
      { title, description, image, price: raw, claim_window_ms: window },
      { tgas: 30n }
    );
    const created = out.events.find((e) => e.standard === "recourse" && e.event === "listing_created");
    if (!created) {
      return bad(out.failures[0] ? cleanError(new Error(out.failures[0])) : "The contract didn't create the link.");
    }
    return NextResponse.json({ id: created.data.listing_id, hash: out.hash });
  } catch (e) {
    return bad(cleanError(e));
  }
}

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}
