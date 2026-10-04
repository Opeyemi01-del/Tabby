// PAYOUTS — forwarding the client's money to the freelancer's own PayPal.
// After a capture, the money sits in Tabby's PayPal account. This sends
// the amount Tabby received (after PayPal's fee) to the freelancer's
// PayPal email with PayPal Payouts.
// A failed payout never undoes the release: the money is safe in Tabby's
// account, and the freelancer can press "Try again".
// Server-only.
import { saveDeal } from "./db";
import { addEvent } from "./events";
import { createPayout, getPayoutStatus } from "./paypal";
import type { Deal, Milestone } from "./types";

// "emeka@example.com" -> "e••••@example.com"
export function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  return `${name.slice(0, 1)}••••@${domain ?? ""}`;
}

// PayPal batch states that mean the money has arrived / won't arrive.
const DONE = ["SUCCESS"];
const FAILED = ["DENIED", "CANCELED"];

// Sends (or retries) the payout for a released milestone.
// Does nothing if there's no payout email, or it was already sent.
export async function sendPayout(deal: Deal, m: Milestone): Promise<void> {
  if (!deal.payoutEmail || m.status !== "released") return;
  if (m.payout?.status === "sent" || (m.payout?.status === "pending" && m.payout.batchId)) return;

  const amount = m.netAmount ?? m.amount;
  try {
    const { batchId, status } = await createPayout({
      email: deal.payoutEmail,
      amount,
      note: `Payment for "${m.title}" (${deal.title}), approved through Tabby.`,
      // Always the SAME key for a milestone: if an earlier try actually
      // reached PayPal, PayPal rejects this one instead of paying twice.
      batchKey: `tabby-${deal.id}-${m.id}`,
    });
    m.payout = { status: DONE.includes(status) ? "sent" : "pending", amount, batchId };
    addEvent(deal, {
      type: "payout_sent",
      milestoneId: m.id,
      summary: `$${amount.toFixed(2)} sent to the freelancer's PayPal (${maskEmail(deal.payoutEmail)})`,
      proof: [`PayPal payout batch ${batchId}`],
    });
  } catch (err) {
    const message = (err as Error).message;
    m.payout = {
      status: "failed",
      amount,
      error: /already (been )?used|duplicate/i.test(message)
        ? "PayPal already received this payout earlier — check the PayPal account before trying anything else"
        : message,
    };
  }
  saveDeal(deal);
}

// Asks PayPal whether a pending payout has arrived yet.
export async function refreshPayout(deal: Deal, m: Milestone): Promise<void> {
  if (m.payout?.status !== "pending" || !m.payout.batchId) return;
  const status = await getPayoutStatus(m.payout.batchId);
  if (DONE.includes(status)) m.payout.status = "sent";
  if (FAILED.includes(status)) m.payout = { ...m.payout, status: "failed", error: `PayPal payout ${status.toLowerCase()}` };
  saveDeal(deal);
}
