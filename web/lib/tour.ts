"use client";

/** State of the guided demo, kept in the browser so it survives page changes. */
export type Tour = { step: number; listing?: string; token?: string };

const KEY = "recourse-tour";

export function readTour(): Tour | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Tour) : null;
  } catch {
    return null;
  }
}

export function writeTour(t: Tour | null) {
  try {
    if (t) localStorage.setItem(KEY, JSON.stringify(t));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: the guide simply won't persist */
  }
  window.dispatchEvent(new CustomEvent("recourse:tour"));
}

/** Components call this after an action succeeds so the guide can move on. */
export function tourEmit(kind: string, detail: Record<string, string> = {}) {
  window.dispatchEvent(new CustomEvent("recourse:event", { detail: { kind, ...detail } }));
}

export async function actAs(key: string) {
  await fetch("/api/identity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ as: key }),
  });
}

/** Text the demo pre-fills into forms, by step. */
export const DEMO_TEXT = {
  link: {
    title: "Leather market tote",
    price: "20",
    description: "Honey-brown leather tote, 40 cm wide, two leather handles riveted to the body. New, unused.",
  },
  claim:
    "The tote arrived on Tuesday with the left handle torn away from its rivet. The rivet was loose in the bag. Photo attached.",
  respond:
    "I shipped it in perfect condition and I believe it was damaged in transit. I have no photo of the handles before dispatch.",
};
