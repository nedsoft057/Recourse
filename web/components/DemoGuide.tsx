"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { actAs, readTour, writeTour, type Tour } from "@/lib/tour";

type Step = {
  who: string;
  whoName: string;
  title: string;
  body: string;
  path: (t: Tour) => string;
  /** The action that moves the guide on, or a button label for a step you just read. */
  waitFor?: string;
  next?: string;
};

const STEPS: Step[] = [
  {
    who: "loomhouse",
    whoName: "Loom House",
    title: "You're Loom House, a seller",
    body: "Make a protected payment link for a leather tote. It's filled in for you: 20 USDC with a 5-minute claim window. Press Create link.",
    path: () => "/new",
    waitFor: "link",
  },
  {
    who: "loomhouse",
    whoName: "Loom House",
    title: "This is the link Loom House shares",
    body: "They'd send it on WhatsApp or Instagram, or show the QR code. Now open it as the buyer.",
    path: (t) => `/p/${t.listing}/ready`,
    next: "Continue as Ada, the buyer",
  },
  {
    who: "buyer-a",
    whoName: "Ada",
    title: "You're Ada, the buyer",
    body: "Look at the split: half goes to Loom House now, half is held in a receipt NFT that you'll own. Press Pay.",
    path: (t) => `/p/${t.listing}`,
    waitFor: "buy",
  },
  {
    who: "buyer-a",
    whoName: "Ada",
    title: "Your receipt holds the protection",
    body: "Say Ada resells the tote to Bayo. Pass the receipt on to Bayo, and the protection goes with the bag.",
    path: () => "/purchases",
    waitFor: "pass_on",
  },
  {
    who: "buyer-b",
    whoName: "Bayo",
    title: "You're Bayo, the new owner",
    body: "The handle tore on arrival. Bayo never paid Loom House, but he holds the receipt, so he can claim. The claim is filled in: press Claim.",
    path: (t) => `/case/${t.token}`,
    waitFor: "claim",
  },
  {
    who: "loomhouse",
    whoName: "Loom House",
    title: "Back to Loom House: answer the claim",
    body: "The seller gives their side. The AI judge in a NEAR AI Cloud enclave rules a few seconds after it's sent.",
    path: (t) => `/case/${t.token}`,
    waitFor: "respond",
  },
  {
    who: "loomhouse",
    whoName: "Loom House",
    title: "The ruling",
    body: "Read the judge's reasons. Under Verify this ruling, the hash of the ruling and both sides' evidence is checked against what was recorded on-chain, with the enclave's chat ID and signing address. The money stays held while either side can appeal to a person; then it goes to Bayo, the current holder.",
    path: (t) => `/case/${t.token}`,
    next: "Finish",
  },
];

export function DemoGuide({ current }: { current: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [tour, setTour] = useState<Tour | null>(null);
  const [busy, setBusy] = useState(false);
  const [small, setSmall] = useState(false);

  useEffect(() => {
    const sync = () => setTour(readTour());
    sync();
    const onEvent = (e: Event) => {
      const d = (e as CustomEvent).detail as Record<string, string>;
      const t = readTour();
      if (!t || t.step >= STEPS.length) return;
      const step = STEPS[t.step];
      if (step.waitFor !== d.kind) return;
      writeTour({ ...t, step: t.step + 1, listing: d.id ?? t.listing, token: d.token ?? t.token });
    };
    window.addEventListener("recourse:tour", sync);
    window.addEventListener("recourse:event", onEvent);
    return () => {
      window.removeEventListener("recourse:tour", sync);
      window.removeEventListener("recourse:event", onEvent);
    };
  }, []);

  if (!tour) return null;

  const close = () => writeTour(null);

  if (tour.step >= STEPS.length) {
    return (
      <aside className="guide" aria-label="Demo guide">
        <p className="guide-step">Demo complete</p>
        <h2 className="guide-title">That&apos;s Recourse</h2>
        <p className="guide-body">
          A payment with a chargeback, protection that moved with a resale, and a dispute decided on evidence. Also try{" "}
          <b>Not arrived yet? Extend window</b> on a receipt, and the <b>Seller desk</b> to collect finished orders.
        </p>
        <div className="guide-actions">
          <button className="button" onClick={close}>Close</button>
        </div>
      </aside>
    );
  }

  const step = STEPS[tour.step];
  const target = step.path(tour);
  const here = pathname === target.split("?")[0];
  const asRight = current === step.who;

  async function go(advance: boolean) {
    setBusy(true);
    const t = advance ? { ...tour!, step: tour!.step + 1 } : tour!;
    const s = STEPS[t.step];
    if (advance) writeTour(t);
    if (s) {
      if (current !== s.who) await actAs(s.who);
      router.push(s.path(t));
    }
    router.refresh();
    setBusy(false);
  }

  return (
    <aside className={`guide${small ? " small" : ""}`} aria-label="Demo guide" aria-live="polite">
      <div className="guide-top">
        <p className="guide-step">
          Step {tour.step + 1} of {STEPS.length}
        </p>
        <div className="guide-dots" aria-hidden="true">
          {STEPS.map((_, i) => (
            <span key={i} className={i < tour.step ? "done" : i === tour.step ? "on" : ""} />
          ))}
        </div>
        <button className="guide-x" onClick={() => setSmall(!small)} aria-label={small ? "Show the guide" : "Hide the guide"}>
          {small ? "Show" : "Hide"}
        </button>
      </div>
      {!small && (
        <>
          <h2 className="guide-title">{step.title}</h2>
          <p className="guide-body">{step.body}</p>
          <div className="guide-actions">
            {(!here || !asRight) && (
              <button className="button" disabled={busy} onClick={() => go(false)}>
                {busy ? "One moment…" : asRight ? "Take me there" : `Continue as ${step.whoName}`}
              </button>
            )}
            {here && asRight && step.next && (
              <button className="button" disabled={busy} onClick={() => go(true)}>
                {busy ? "One moment…" : step.next}
              </button>
            )}
            <button className="guide-exit" onClick={close}>Exit demo</button>
          </div>
        </>
      )}
    </aside>
  );
}
