"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DEMO_TEXT, readTour, tourEmit } from "@/lib/tour";
import { Attachments, type FileRef } from "@/components/Attachments";

export type CaseMode =
  | { kind: "none" }
  | { kind: "claim" }
  | { kind: "respond" }
  | { kind: "default" }
  | { kind: "judge" }
  | { kind: "appeal" }
  | { kind: "finalize" }
  | { kind: "resolve" }
  | { kind: "timeout" }
  | { kind: "waiting"; text: string };

export function CaseActions({
  tokenId,
  mode,
  seller,
  held,
}: {
  tokenId: string;
  mode: CaseMode;
  seller: string;
  held: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [reason, setReason] = useState("not_delivered");
  const [statement, setStatement] = useState("");
  const [photo, setPhoto] = useState("");
  const [bps, setBps] = useState(10_000);
  const [files, setFiles] = useState<FileRef[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const step = readTour()?.step;
    if (step === 4 && mode.kind === "claim") {
      setReason("damaged");
      setStatement(DEMO_TEXT.claim);
    }
    if (step === 5 && mode.kind === "respond") setStatement(DEMO_TEXT.respond);
  }, [mode.kind]);

  async function send(action: string, extra: object = {}) {
    setBusy(true);
    setError("");
    setResult("");
    try {
      const res = await fetch("/api/dispute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, token_id: tokenId, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "That didn't go through.");
      if (data.judged?.outcome) setResult(data.judged.outcome);
      setStatement("");
      setPhoto("");
      setFiles([]);
      if (action === "open_claim") tourEmit("claim");
      if (action === "respond") tourEmit("respond");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  const evidenceFields = (placeholder: string) => (
    <>
      <label className="field">
        What happened
        <textarea required minLength={10} maxLength={1500} value={statement} onChange={(e) => setStatement(e.target.value)} placeholder={placeholder} />
      </label>
      <Attachments value={files} onChange={setFiles} onBusy={setUploading} />
    </>
  );

  const shell = (title: string, children: React.ReactNode, note?: string) => (
    <section className="card" style={{ padding: "1.1rem", display: "grid", gap: "0.8rem" }} aria-label={title}>
      <h2 style={{ fontSize: "1.5rem" }}>{title}</h2>
      {note && <p className="small muted">{note}</p>}
      {children}
      {result && <p className="notice" aria-live="polite">{result}</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  );

  switch (mode.kind) {
    case "claim":
      return shell(
        "Something wrong? Claim it back",
        <form style={{ display: "grid", gap: "0.8rem" }} onSubmit={(e) => { e.preventDefault(); send("open_claim", { reason, statement, photo: photo || null, files }); }}>
          <label className="field">
            What went wrong
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="not_delivered">It never arrived</option>
              <option value="not_as_described">It isn't as described</option>
              <option value="damaged">It arrived damaged</option>
            </select>
          </label>
          {evidenceFields("Dates, what you received, messages with the seller.")}
          <button className="button" disabled={busy || uploading}>{busy ? "Opening claim…" : `Claim ${held} USDC back`}</button>
        </form>,
        `${held} USDC is frozen as soon as you claim. ${seller} gets a chance to respond, then the AI judge rules.`
      );
    case "respond":
      return shell(
        "Respond to the claim",
        <form style={{ display: "grid", gap: "0.8rem" }} onSubmit={(e) => { e.preventDefault(); send("respond", { statement, photo: photo || null, files }); }}>
          {evidenceFields("Tracking number and status, delivery photo, your messages with the buyer.")}
          <button className="button" disabled={busy || uploading}>{busy ? "Sending, then the AI judge rules…" : "Send response"}</button>
        </form>,
        "The AI judge rules right after you respond. If you don't respond in time, the buyer is refunded."
      );
    case "default":
      return shell(
        "The seller didn't respond in time",
        <button className="button" disabled={busy} onClick={() => send("default_judgment")}>
          {busy ? "Refunding…" : `Refund ${held} USDC to the receipt holder`}
        </button>
      );
    case "judge":
      return shell(
        "The AI judge is reviewing",
        <button className="button quiet" disabled={busy} onClick={() => send("judge")}>
          {busy ? "Asking the judge…" : "Ask the judge to rule now"}
        </button>,
        "Both sides have had their say. If no ruling appears, ask the judge again; anything it can't decide goes to a person."
      );
    case "appeal":
      return shell(
        "Disagree? Appeal once",
        <form style={{ display: "grid", gap: "0.8rem" }} onSubmit={(e) => { e.preventDefault(); send("appeal", { reason: statement, files }); }}>
          <label className="field">
            Why the ruling is wrong
            <textarea required minLength={10} maxLength={280} value={statement} onChange={(e) => setStatement(e.target.value)} />
          </label>
          <Attachments value={files} onChange={setFiles} onBusy={setUploading} />
          <button className="button quiet" disabled={busy || uploading}>{busy ? "Appealing…" : "Send to a human reviewer"}</button>
        </form>,
        "The money stays held while you can appeal. A human reviewer's decision is final."
      );
    case "finalize":
      return shell(
        "The appeal window has closed",
        <button className="button" disabled={busy} onClick={() => send("finalize")}>
          {busy ? "Paying out…" : "Carry out the ruling"}
        </button>,
        "Anyone can do this. It pays out exactly what the ruling says."
      );
    case "resolve":
      return shell(
        "Decide this case",
        <form style={{ display: "grid", gap: "0.8rem" }} onSubmit={(e) => { e.preventDefault(); send("resolve", { buyer_bps: bps, note: statement }); }}>
          <div className="segmented" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            {[
              { label: "Refund buyer", v: 10_000 },
              { label: "Split 50/50", v: 5_000 },
              { label: "Pay seller", v: 0 },
            ].map((o) => (
              <button type="button" key={o.v} aria-pressed={bps === o.v} onClick={() => setBps(o.v)}>{o.label}</button>
            ))}
          </div>
          <label className="field">
            Your reasoning (stored on-chain with the decision)
            <textarea required minLength={10} maxLength={1000} value={statement} onChange={(e) => setStatement(e.target.value)} />
          </label>
          <button className="button" disabled={busy}>{busy ? "Recording…" : "Record final decision"}</button>
        </form>
      );
    case "timeout":
      return shell(
        "The review is overdue",
        <button className="button" disabled={busy} onClick={() => send("review_timeout")}>
          {busy ? "Refunding…" : `Refund ${held} USDC to the receipt holder`}
        </button>,
        "Undecided reviews refund the holder, so money is never stuck."
      );
    case "waiting":
      return <p className="notice">{mode.text}</p>;
    default:
      return null;
  }
}
