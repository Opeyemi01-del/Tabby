// DISPUTE SHIELD — the deal's tamper-evident history.
// Every important step (paid, delivered, verified, approved...) is added
// as an event. Each event's fingerprint (SHA-256) covers its own content
// AND the previous event's fingerprint, like links in a chain. If anyone
// edits or deletes a past event, the chain no longer checks out.
// Server-only. Uses no AI.
import { createHash } from "node:crypto";
import type { Deal, DealEvent } from "./types";

function fingerprint(e: Omit<DealEvent, "hash">): string {
  // Fixed field order, so the same event always gives the same fingerprint.
  const content = JSON.stringify([e.type, e.at, e.milestoneId ?? "", e.summary, e.proof ?? [], e.prevHash]);
  return createHash("sha256").update(content).digest("hex");
}

// Adds an event to the deal (the caller still saves the deal).
export function addEvent(deal: Deal, event: Omit<DealEvent, "at" | "prevHash" | "hash">) {
  const events = (deal.events ??= []);
  const draft = { ...event, at: new Date().toISOString(), prevHash: events.at(-1)?.hash ?? "" };
  events.push({ ...draft, hash: fingerprint(draft) });
}

// Re-computes every link. Returns true if the history is untouched.
export function verifyChain(events: DealEvent[]): boolean {
  let prev = "";
  for (const e of events) {
    if (e.prevHash !== prev || fingerprint(e) !== e.hash) return false;
    prev = e.hash;
  }
  return true;
}

// Fingerprint of any text (e.g. the agreement) — shown as proof.
export function sha256Text(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

// Short form for display: "a5da7734…"
export function short(hash: string): string {
  return `${hash.slice(0, 8)}…`;
}
