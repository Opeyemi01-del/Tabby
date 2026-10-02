// POST /api/deals/{id}/milestones/{milestoneId}/submit   { deliveryNote }
// The freelancer submits their work; the AI checks it against the agreement.
// "pass" moves the milestone to "work_submitted" (ready to release).
// "concerns" keeps it at "funds_held" so they can fix it and resubmit.
import { checkDelivery } from "@/lib/ai";
import { handleError, jsonError, readJson } from "@/lib/api";
import { findDeal, saveDeal } from "@/lib/db";

export async function POST(req: Request, ctx: RouteContext<"/api/deals/[id]/milestones/[milestoneId]/submit">) {
  const { id, milestoneId } = await ctx.params;
  const deal = findDeal(id);
  const milestone = deal?.milestones.find((m) => m.id === milestoneId);
  if (!deal || !milestone) return jsonError("Milestone not found", 404);
  if (milestone.status !== "funds_held") return jsonError("Work can only be submitted once the client's funds are held", 409);

  const { deliveryNote } = await readJson(req);
  if (typeof deliveryNote !== "string" || deliveryNote.trim() === "") return jsonError("Describe what you delivered");
  if (deliveryNote.length > 5_000) return jsonError("Delivery note is too long (max 5,000 characters)");

  try {
    const aiCheck = await checkDelivery(deal, milestone, deliveryNote.trim());
    milestone.deliveryNote = deliveryNote.trim();
    milestone.aiCheck = aiCheck;
    if (aiCheck.verdict === "pass") milestone.status = "work_submitted";
    saveDeal(deal);
    return Response.json({ status: milestone.status, aiCheck });
  } catch (err) {
    return handleError(err);
  }
}
