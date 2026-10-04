// RELEASE & REFUND RULES — who may move held money, and when.
// Release (money to the freelancer):
//   • The client (whoever paid) can approve any delivered work.
//   • If the client stays silent, the freelancer can release once the
//     review period ends — but ONLY if the AI verified the actual files.
// Refund (cancel the hold, money stays with the client):
//   • The freelancer can cancel at any time before payout.
//   • The client can cancel only if the freelancer missed a deadline:
//     no delivery by the due date, or no fix within the fix period.
//   • PayPal itself frees an uncaptured hold after 29 days.
// Server-only.
import { captureAuthorization, voidAuthorization } from "./paypal";
import { saveDeal } from "./db";
import { addEvent } from "./events";
import { sendPayout } from "./payout";
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

// How long the freelancer has to fix work after the client asks for
// changes. Set FIX_PERIOD_HOURS in .env.local (e.g. 0.05 for a demo). Default: 3 days.
export function fixDeadlineFromNow(): string {
  const hours = Number(process.env.FIX_PERIOD_HOURS ?? 72);
  return new Date(Date.now() + (Number.isFinite(hours) && hours > 0 ? hours : 72) * 3_600_000).toISOString();
}

// Has the freelancer handed in work the client can look at?
export function hasSubmission(m: Milestone): boolean {
  return Boolean(m.submittedAt && m.aiCheck);
}

// Can the client approve or comment on this milestone right now?
// (Delivered work awaiting review, or work the AI flagged with concerns.)
export function clientCanReview(m: Milestone): boolean {
  return m.status === "work_submitted" || (m.status === "funds_held" && hasSubmission(m));
}

// The moment after which the client may cancel and get their money back.
export function cancelDeadline(m: Milestone): string {
  // A fix was requested: the fix deadline. Otherwise: the end of the due date.
  return m.fixDeadline ?? new Date(`${m.dueDate}T23:59:59`).toISOString();
}

// Can the client cancel and get their money back? null = yes, else why not.
export function clientCancelBlocker(m: Milestone): string | null {
  if (m.status !== "funds_held") {
    return m.status === "work_submitted"
      ? "Work has been delivered — review it, or ask for changes first"
      : "There's no held payment to cancel";
  }
  if (Date.now() < Date.parse(cancelDeadline(m))) {
    return "You can cancel if the freelancer misses the deadline";
  }
  return null;
}

// Can the freelancer cancel and refund? null = yes, else why not.
export function freelancerCancelBlocker(m: Milestone): string | null {
  return m.status === "funds_held" || m.status === "work_submitted" ? null : "There's no held payment to cancel";
}

// Cancels the PayPal hold: the client's money is freed, nothing is charged.
export async function refundMilestone(deal: Deal, m: Milestone, by: "client" | "freelancer") {
  if (!m.authorizationId) throw new Error("No PayPal hold found for this milestone");
  await voidAuthorization(m.authorizationId);
  m.status = "refunded";
  m.refundedBy = by;
  m.reviewDeadline = undefined;
  addEvent(deal, {
    type: "refunded",
    milestoneId: m.id,
    summary:
      by === "freelancer"
        ? `Freelancer cancelled "${m.title}" — the $${m.amount.toFixed(2)} hold was released back to the client`
        : `Freelancer missed the deadline — client cancelled and the $${m.amount.toFixed(2)} hold was released back to them`,
    proof: [`PayPal authorization ${m.authorizationId} voided`],
  });
  saveDeal(deal);
  return { status: m.status };
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
  const { captureId, status, netAmount } = await captureAuthorization(m.authorizationId);
  m.captureId = captureId;
  m.netAmount = netAmount;
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
  // Forward the money to the freelancer's own PayPal (never throws).
  await sendPayout(deal, m);
  return { status: m.status, paypalStatus: status, payout: m.payout };
}
