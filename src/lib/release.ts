// RELEASE RULES (layer 1) — who may release held money, and when.
//   • The client (whoever paid) can approve at any time during review.
//   • If the client stays silent, the freelancer can release once the
//     review period ends — but ONLY if the AI verified the actual files.
//     A "claimed only" delivery always needs the client's approval.
// Server-only.
import { captureAuthorization } from "./paypal";
import { saveDeal } from "./db";
import { addEvent } from "./events";
import type { Deal, Milestone } from "./types";

// How long the client has to review. Set REVIEW_PERIOD_HOURS in .env.local
// (e.g. 0.05 = 3 minutes, handy for the demo). Default: 3 days.
export function reviewPeriodHours(): number {
  const hours = Number(process.env.REVIEW_PERIOD_HOURS ?? 72);
  return Number.isFinite(hours) && hours > 0 ? hours : 72;
}

export function reviewDeadlineFromNow(): string {
  return new Date(Date.now() + reviewPeriodHours() * 3_600_000).toISOString();
}

// Can the freelancer release this milestone without the client?
// Returns null if yes, or the reason why not.
export function autoReleaseBlocker(m: Milestone): string | null {
  if (m.status !== "work_submitted") return "This milestone isn't waiting for review";
  if (m.aiCheck?.verdict !== "verified") {
    return "This delivery wasn't verified from real files, so only the client can approve it";
  }
  if (!m.reviewDeadline || Date.now() < Date.parse(m.reviewDeadline)) {
    return "The client's review period hasn't ended yet";
  }
  return null;
}

// Captures the held PayPal payment and records who released it.
export async function releaseMilestone(deal: Deal, m: Milestone, by: "client" | "auto") {
  if (!m.authorizationId) throw new Error("No PayPal hold found for this milestone");
  const { captureId, status } = await captureAuthorization(m.authorizationId);
  m.captureId = captureId;
  m.releasedBy = by;
  addEvent(deal, {
    type: "released",
    milestoneId: m.id,
    summary:
      by === "client"
        ? `Client approved — $${m.amount.toFixed(2)} released to the freelancer`
        : `Review period ended with no response — $${m.amount.toFixed(2)} released (AI-verified delivery)`,
    proof: [`PayPal capture ${captureId} (${status})`],
  });
  // PENDING can happen in sandbox (e.g. review); the webhook finishes it.
  if (status === "COMPLETED") m.status = "released";
  saveDeal(deal);
  return { status: m.status, paypalStatus: status };
}
