// POST /api/deals/{id}/milestones/{milestoneId}/release
// Captures the held PayPal payment: the money goes to the freelancer.
// Only allowed after the work passed the AI check.
import { handleError, jsonError } from "@/lib/api";
import { findDeal, saveDeal } from "@/lib/db";
import { captureAuthorization } from "@/lib/paypal";

export async function POST(_req: Request, ctx: RouteContext<"/api/deals/[id]/milestones/[milestoneId]/release">) {
  const { id, milestoneId } = await ctx.params;
  const deal = findDeal(id);
  const milestone = deal?.milestones.find((m) => m.id === milestoneId);
  if (!deal || !milestone) return jsonError("Milestone not found", 404);
  if (milestone.status !== "work_submitted") return jsonError("Funds can only be released after the work passes the AI check", 409);
  if (!milestone.authorizationId) return jsonError("No PayPal hold found for this milestone", 409);

  try {
    const { captureId, status } = await captureAuthorization(milestone.authorizationId);
    milestone.captureId = captureId;
    // PENDING can happen in sandbox (e.g. review); the webhook will finish it.
    if (status === "COMPLETED") milestone.status = "released";
    saveDeal(deal);
    return Response.json({ status: milestone.status, paypalStatus: status });
  } catch (err) {
    return handleError(err);
  }
}
