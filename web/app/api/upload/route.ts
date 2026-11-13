import { NextResponse } from "next/server";
import { storeFile } from "@/lib/files";

export const maxDuration = 30;

// One file per request, so each can be up to 4 MB.
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file received." }, { status: 400 });
    return NextResponse.json({ file: await storeFile(file) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "The upload failed." }, { status: 400 });
  }
}
