import { NextResponse } from "next/server";
import { act, view, cleanError, CONTRACT, TOKEN } from "@/lib/chain";
import { accountOf, currentPerson } from "@/lib/identity";
import type { ListingView } from "@/lib/types";

export async function POST(req: Request) {
  const me = await currentPerson();
  if (me.role !== "buyer") {
    return NextResponse.json({ error: "Switch to a buyer to make a purchase." }, { status: 400 });
  }
  const { listing_id } = await req.json();
  const listing = await view<ListingView | null>("get_listing", { listing_id: Number(listing_id) });
  if (!listing || !listing.listing.active) {
    return NextResponse.json({ error: "This piece isn't for sale right now." }, { status: 404 });
  }
  try {
    // Pay the exact price to the contract; the contract splits it and mints the receipt.
    const out = await act(
      accountOf(me.key),
      "ft_transfer_call",
      {
        receiver_id: CONTRACT,
        amount: listing.listing.price,
        msg: JSON.stringify({ listing_id: listing.id }),
      },
      { contract: TOKEN, deposit: 1n, tgas: 80n }
    );
    const purchased = out.events.find((e) => e.standard === "recourse" && e.event === "purchased");
    if (!purchased) {
      const reason = out.failures[0]?.replace(/^Smart contract panicked: /, "") || "the contract returned it";
      return NextResponse.json(
        { error: `Payment was returned to you: ${reason}.`, hash: out.hash },
        { status: 400 }
      );
    }
    return NextResponse.json({ token_id: purchased.data.token_id, hash: out.hash });
  } catch (e) {
    return NextResponse.json({ error: cleanError(e) }, { status: 500 });
  }
}
