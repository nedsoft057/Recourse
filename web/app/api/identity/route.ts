import { NextResponse } from "next/server";
import { PEOPLE } from "@/lib/identity";

export async function POST(req: Request) {
  const { as } = await req.json();
  if (!PEOPLE.some((p) => p.key === as)) {
    return NextResponse.json({ error: "Unknown person" }, { status: 400 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set("as", as, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
  return res;
}
