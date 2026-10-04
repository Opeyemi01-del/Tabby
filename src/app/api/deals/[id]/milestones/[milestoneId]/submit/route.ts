// POST /api/deals/{id}/milestones/{milestoneId}/submit
// Form fields: deliveryNote (text), files (uploads), links (one per field).
// The freelancer hands in the work; the server saves the files, fetches
// the links, and the AI inspects the REAL content against the agreement.
//   verified / claimed_only -> "work_submitted": the client reviews it
//   concerns                -> stays "funds_held" so the freelancer can fix it
import { checkDelivery } from "@/lib/ai";
import { handleError, jsonError } from "@/lib/api";
import { findDeal, saveDeal } from "@/lib/db";
import { checkLink, LIMITS, saveUploadedFile, type Evidence } from "@/lib/deliverables";
import { addEvent, short } from "@/lib/events";
import { reviewDeadlineFromNow } from "@/lib/release";

const VERDICT_LABELS = { verified: "verified from the files", claimed_only: "claimed only", concerns: "concerns" };
import type { Deliverable } from "@/lib/types";

export async function POST(req: Request, ctx: RouteContext<"/api/deals/[id]/milestones/[milestoneId]/submit">) {
  const { id, milestoneId } = await ctx.params;
  const deal = findDeal(id);
  const milestone = deal?.milestones.find((m) => m.id === milestoneId);
  if (!deal || !milestone) return jsonError("Milestone not found", 404);
  if (milestone.status !== "funds_held") return jsonError("Work can only be submitted once the client's funds are held", 409);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError("Couldn't read the upload — please try again");
  }

  const note = String(form.get("deliveryNote") ?? "").trim();
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  const links = form.getAll("links").map((l) => String(l).trim()).filter(Boolean);

  // Check limits before saving anything.
  if (note.length > 5_000) return jsonError("Delivery note is too long (max 5,000 characters)");
  if (files.length === 0 && links.length === 0) {
    return jsonError("Attach at least one file or link so the AI can check the actual work");
  }
  if (files.length > LIMITS.files) return jsonError(`Attach at most ${LIMITS.files} files`);
  if (links.length > LIMITS.links) return jsonError(`Add at most ${LIMITS.links} links`);
  if (files.some((f) => f.size > LIMITS.fileBytes)) return jsonError("Each file must be under 8 MB");
  if (files.reduce((sum, f) => sum + f.size, 0) > LIMITS.totalBytes) return jsonError("Files must be under 12 MB in total");

  try {
    // Save files and fetch links (links in parallel — they're slow).
    const results = [
      ...(await Promise.all(files.map(saveUploadedFile))),
      ...(await Promise.all(links.map(checkLink))),
    ];
    const deliverables: Deliverable[] = results.map((r) => r.deliverable);
    const evidence: Evidence[] = results.flatMap((r) => (r.evidence ? [r.evidence] : []));

    const aiCheck = await checkDelivery(deal, milestone, note, evidence);

    milestone.deliveryNote = note;
    milestone.deliverables = deliverables;
    milestone.submittedAt = new Date().toISOString();
    milestone.aiCheck = aiCheck;

    // Dispute Shield: what was delivered (with fingerprints) and the AI's verdict.
    addEvent(deal, {
      type: "work_submitted",
      milestoneId: milestone.id,
      summary: `Work delivered for "${milestone.title}": ${deliverables.length} item${deliverables.length > 1 ? "s" : ""}`,
      proof: deliverables.map((d) => `${d.kind === "file" ? "File" : "Link"} ${d.name}${d.sha256 ? ` · ${short(d.sha256)}` : ""}`),
    });
    const met = aiCheck.checklist?.filter((c) => c.met === "yes").length ?? 0;
    const total = aiCheck.checklist?.length ?? 0;
    addEvent(deal, {
      type: "ai_checked",
      milestoneId: milestone.id,
      summary: `AI check: ${VERDICT_LABELS[aiCheck.verdict]}${total ? ` (${met} of ${total} requirements met)` : ""}`,
    });

    if (aiCheck.verdict !== "concerns") {
      milestone.status = "work_submitted";
      milestone.reviewDeadline = reviewDeadlineFromNow();
      milestone.clientFeedback = undefined; // this new delivery answers it
      milestone.fixDeadline = undefined; // the fix arrived in time
    }
    saveDeal(deal);
    return Response.json({ status: milestone.status, aiCheck, deliverables });
  } catch (err) {
    return handleError(err);
  }
}
