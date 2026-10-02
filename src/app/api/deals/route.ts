// POST /api/deals   { title, clientName, clientEmail, agreement, milestones }
// Saves a new deal (after the freelancer reviewed the AI draft).
import { isoDateInDays, jsonError, readJson } from "@/lib/api";
import { newDealId, saveDeal } from "@/lib/db";
import type { Deal } from "@/lib/types";

export async function POST(req: Request) {
  const body = await readJson(req);
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  const title = text(body.title);
  const clientName = text(body.clientName);
  const clientEmail = text(body.clientEmail);
  const agreement = text(body.agreement);
  const rawMilestones = Array.isArray(body.milestones) ? body.milestones : [];

  if (!title || !clientName) return jsonError("Project title and client name are required");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) return jsonError("Enter a valid client email");
  if (rawMilestones.length === 0 || rawMilestones.length > 10) return jsonError("Add between 1 and 10 milestones");

  const milestones: Deal["milestones"] = [];
  for (const [i, raw] of rawMilestones.entries()) {
    const m = (raw ?? {}) as Record<string, unknown>;
    const amount = Math.round(Number(m.amount) * 100) / 100;
    const dueInDays = Number(m.dueInDays ?? 7);
    if (!text(m.title)) return jsonError(`Milestone ${i + 1} needs a title`);
    if (!Number.isFinite(amount) || amount < 1 || amount > 10_000) {
      return jsonError(`Milestone ${i + 1}: amount must be between $1 and $10,000`);
    }
    // PayPal holds stay capturable for 29 days, so keep due dates inside that.
    if (!Number.isInteger(dueInDays) || dueInDays < 1 || dueInDays > 29) {
      return jsonError(`Milestone ${i + 1}: due date must be 1–29 days away`);
    }
    milestones.push({
      id: `m-${i + 1}`,
      title: text(m.title),
      amount,
      dueDate: isoDateInDays(dueInDays),
      status: "awaiting_payment",
    });
  }

  const deal: Deal = {
    id: newDealId(),
    title,
    clientName,
    clientEmail,
    currency: "USD",
    createdAt: isoDateInDays(0),
    agreement,
    milestones,
  };
  saveDeal(deal);
  return Response.json({ id: deal.id }, { status: 201 });
}
