// POST /api/deals   { title, clientName, clientEmail, agreement, milestones }
// Saves a new deal (after the freelancer reviewed the AI draft).
// Screenshot deals send a form instead: field "deal" (that JSON) plus the
// original "screenshots", which are kept privately as dispute evidence.
import { isoDateInDays, jsonError, readJson } from "@/lib/api";
import { newDealId, saveDeal } from "@/lib/db";
import { saveUploadedFile } from "@/lib/deliverables";
import { addEvent, sha256Text, short } from "@/lib/events";
import type { Deal, Deliverable } from "@/lib/types";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  let screenshots: File[] = [];

  if (req.headers.get("content-type")?.includes("multipart/form-data")) {
    try {
      const form = await req.formData();
      body = JSON.parse(String(form.get("deal") ?? "{}"));
      screenshots = form.getAll("screenshots").filter((f): f is File => f instanceof File && f.size > 0);
    } catch {
      return jsonError("Couldn't read the deal — please try again");
    }
    if (screenshots.length > 3) return jsonError("Upload at most 3 screenshots");
    if (screenshots.some((f) => !IMAGE_TYPES.includes(f.type) || f.size > 5 * 1024 * 1024)) {
      return jsonError("Screenshots must be PNG, JPG or WebP images under 5 MB");
    }
  } else {
    body = await readJson(req);
  }
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  const title = text(body.title);
  const clientName = text(body.clientName);
  const clientEmail = text(body.clientEmail);
  const agreement = text(body.agreement);
  const payoutEmail = text(body.payoutEmail).toLowerCase();
  if (payoutEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payoutEmail)) {
    return jsonError("Enter a valid PayPal email for your payouts");
  }
  const jobType = body.jobType === "onsite" ? "onsite" : "digital";
  const jobLocation = jobType === "onsite" ? text(body.jobLocation).slice(0, 80) : "";
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
      // "materials" only makes sense for on-site jobs.
      kind: jobType === "onsite" && m.kind === "materials" ? "materials" : "work",
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
    ...(payoutEmail ? { payoutEmail } : {}),
    jobType,
    ...(jobLocation ? { jobLocation } : {}),
    milestones,
  };

  // Keep the original screenshots (fingerprinted) as private evidence.
  const agreementFiles: Deliverable[] = [];
  for (const file of screenshots) agreementFiles.push((await saveUploadedFile(file)).deliverable);
  if (agreementFiles.length) deal.agreementFiles = agreementFiles;

  // Dispute Shield: the first link in the chain.
  addEvent(deal, {
    type: "deal_created",
    summary: agreementFiles.length
      ? `Agreement recorded from ${agreementFiles.length} chat screenshot${agreementFiles.length > 1 ? "s" : ""}`
      : "Agreement recorded from the client chat",
    proof: [
      `Agreement fingerprint ${short(sha256Text(agreement))}`,
      ...agreementFiles.map((f) => `Screenshot ${f.name} · ${short(f.sha256 ?? "")}`),
    ],
  });
  saveDeal(deal);
  return Response.json({ id: deal.id }, { status: 201 });
}
