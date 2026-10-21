// POST /api/deals/{id}/milestones/{milestoneId}/submit
// Form fields: deliveryNote (text), files (uploads), links (one per field).
// On-site work sends "after" photos instead: photos + takenAt (see start/).
// The freelancer hands in the work; the server saves the files, fetches
// the links, and the AI inspects the REAL content against the agreement.
//   verified / claimed_only -> "work_submitted": the client reviews it
//   concerns                -> stays "funds_held" so the freelancer can fix it
import { checkDelivery } from "@/lib/ai";
import { handleError, jsonError, sampleOnly } from "@/lib/api";
import { findDeal, saveDeal } from "@/lib/db";
import { checkLink, LIMITS, saveUploadedFile, type Evidence } from "@/lib/deliverables";
import { addEvent, short } from "@/lib/events";
import { photoEvidence, photoProof, readPhotos, savePhotos, usesPhotos } from "@/lib/onsite";
import { reviewDeadlineFromNow } from "@/lib/release";
import type { Deliverable } from "@/lib/types";

const VERDICT_LABELS = { verified: "verified from the files", claimed_only: "claimed only", concerns: "concerns" };

export async function POST(req: Request, ctx: RouteContext<"/api/deals/[id]/milestones/[milestoneId]/submit">) {
  const { id, milestoneId } = await ctx.params;
  const deal = findDeal(id);
  const milestone = deal?.milestones.find((m) => m.id === milestoneId);
  if (!deal || !milestone) return jsonError("Milestone not found", 404);
  if (deal.sample) return sampleOnly();
  if (milestone.status !== "funds_held") return jsonError("Work can only be submitted once the client's funds are held", 409);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError("Couldn't read the upload — please try again");
  }

  const note = String(form.get("deliveryNote") ?? "").trim();
  if (note.length > 5_000) return jsonError("Delivery note is too long (max 5,000 characters)");
  const now = new Date().toISOString();

  // ON-SITE work: "after" photos, compared by the AI with the "before" ones.
  const onsite = usesPhotos(deal, milestone);
  const photos = onsite ? readPhotos(form) : [];
  if (onsite) {
    if (!milestone.beforePhotos?.length) return jsonError("Take the before photos first (Start job)");
    if (typeof photos === "string") return jsonError(photos === "Take at least one photo" ? "Take at least one after photo" : photos);
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  const links = form.getAll("links").map((l) => String(l).trim()).filter(Boolean);

  // Check limits before saving anything.
  if (!onsite) {
    if (files.length === 0 && links.length === 0) {
      return jsonError("Attach at least one file or link so the AI can check the actual work");
    }
    if (files.length > LIMITS.files) return jsonError(`Attach at most ${LIMITS.files} files`);
    if (links.length > LIMITS.links) return jsonError(`Add at most ${LIMITS.links} links`);
    if (files.some((f) => f.size > LIMITS.fileBytes)) return jsonError("Each file must be under 8 MB");
    if (files.reduce((sum, f) => sum + f.size, 0) > LIMITS.totalBytes) return jsonError("Files must be under 12 MB in total");
  }

  try {
    let deliverables: Deliverable[];
    let evidence: Evidence[];
    if (onsite && typeof photos !== "string") {
      deliverables = await savePhotos(photos);
      evidence = [
        ...(await photoEvidence("BEFORE", milestone.beforePhotos!, milestone.startedAt)),
        ...(await photoEvidence("AFTER", deliverables, now)),
      ];
    } else {
      // Save files and fetch links (links in parallel — they're slow).
      const results = [
        ...(await Promise.all(files.map(saveUploadedFile))),
        ...(await Promise.all(links.map(checkLink))),
      ];
      deliverables = results.map((r) => r.deliverable);
      evidence = results.flatMap((r) => (r.evidence ? [r.evidence] : []));
    }

    const aiCheck = await checkDelivery(deal, milestone, note, evidence);

    milestone.deliveryNote = note;
    milestone.deliverables = deliverables;
    milestone.submittedAt = now;
    milestone.aiCheck = aiCheck;

    // Dispute Shield: what was delivered (with fingerprints) and the AI's verdict.
    addEvent(deal, {
      type: "work_submitted",
      milestoneId: milestone.id,
      summary: onsite
        ? `Job finished for "${milestone.title}": ${deliverables.length} after photo${deliverables.length > 1 ? "s" : ""}`
        : `Work delivered for "${milestone.title}": ${deliverables.length} item${deliverables.length > 1 ? "s" : ""}`,
      proof: onsite
        ? photoProof(deliverables)
        : deliverables.map((d) => `${d.kind === "file" ? "File" : "Link"} ${d.name}${d.sha256 ? ` · ${short(d.sha256)}` : ""}`),
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
