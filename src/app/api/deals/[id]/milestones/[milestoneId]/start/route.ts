// POST /api/deals/{id}/milestones/{milestoneId}/start
// Form fields: photos (1-3 images), takenAt (one per photo, milliseconds).
// ON-SITE work: the artisan photographs the place BEFORE starting, so the
// AI can later compare the "after" photos with how it looked.
// Can be redone (e.g. a blurry photo) until the work is submitted.
import { handleError, jsonError, sampleOnly } from "@/lib/api";
import { findDeal, saveDeal } from "@/lib/db";
import { addEvent } from "@/lib/events";
import { photoProof, readPhotos, savePhotos, usesPhotos } from "@/lib/onsite";

export async function POST(req: Request, ctx: RouteContext<"/api/deals/[id]/milestones/[milestoneId]/start">) {
  const { id, milestoneId } = await ctx.params;
  const deal = findDeal(id);
  const milestone = deal?.milestones.find((m) => m.id === milestoneId);
  if (!deal || !milestone) return jsonError("Milestone not found", 404);
  if (deal.sample) return sampleOnly();
  if (!usesPhotos(deal, milestone)) return jsonError("Only on-site work uses before photos");
  if (milestone.status !== "funds_held") return jsonError("The job can start once the client's funds are held", 409);
  if (milestone.submittedAt) return jsonError("Work was already delivered — the before photos can't change now", 409);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError("Couldn't read the upload — please try again");
  }
  const photos = readPhotos(form);
  if (typeof photos === "string") return jsonError(photos);

  try {
    const retake = Boolean(milestone.beforePhotos);
    milestone.beforePhotos = await savePhotos(photos);
    milestone.startedAt = new Date().toISOString();
    addEvent(deal, {
      type: "work_started",
      milestoneId: milestone.id,
      summary: `${retake ? "Before photos retaken" : "Job started"} for "${milestone.title}": ${photos.length} before photo${photos.length > 1 ? "s" : ""}`,
      proof: photoProof(milestone.beforePhotos),
    });
    saveDeal(deal);
    return Response.json({ beforePhotos: milestone.beforePhotos });
  } catch (err) {
    return handleError(err);
  }
}
