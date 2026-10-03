// POST /api/deals/{id}/milestones/{milestoneId}/request-changes   { feedback, key? }
// The CLIENT says "not yet": the money stays held and the milestone goes
// back to the freelancer with the client's feedback.
import { jsonError, readJson } from "@/lib/api";
import { getClientKey, isValidClientKey, setClientKeyCookie } from "@/lib/client-key";
import { findDeal, saveDeal } from "@/lib/db";

export async function POST(req: Request, ctx: RouteContext<"/api/deals/[id]/milestones/[milestoneId]/request-changes">) {
  const { id, milestoneId } = await ctx.params;
  const deal = findDeal(id);
  const milestone = deal?.milestones.find((m) => m.id === milestoneId);
  if (!deal || !milestone) return jsonError("Milestone not found", 404);

  const body = await readJson(req);
  const key = await getClientKey(deal.id, typeof body.key === "string" ? body.key : null);
  if (!isValidClientKey(deal, key)) return jsonError("Only the client who paid can review this work", 403);
  if (milestone.status !== "work_submitted") return jsonError("There's no delivered work waiting for review", 409);

  const feedback = typeof body.feedback === "string" ? body.feedback.trim() : "";
  if (!feedback) return jsonError("Tell the freelancer what needs to change");
  if (feedback.length > 2_000) return jsonError("Feedback is too long (max 2,000 characters)");

  milestone.status = "funds_held";
  milestone.clientFeedback = feedback;
  milestone.reviewDeadline = undefined;
  saveDeal(deal);
  await setClientKeyCookie(deal.id, key!);
  return Response.json({ status: milestone.status });
}
