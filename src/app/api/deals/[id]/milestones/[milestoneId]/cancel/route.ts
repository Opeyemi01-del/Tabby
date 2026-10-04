// POST /api/deals/{id}/milestones/{milestoneId}/cancel
// The FREELANCER can't (or won't) finish: cancel the PayPal hold so the
// client's money is freed. Allowed any time before payout.
import { handleError, jsonError } from "@/lib/api";
import { findDeal } from "@/lib/db";
import { freelancerCancelBlocker, refundMilestone } from "@/lib/release";

export async function POST(_req: Request, ctx: RouteContext<"/api/deals/[id]/milestones/[milestoneId]/cancel">) {
  const { id, milestoneId } = await ctx.params;
  const deal = findDeal(id);
  const milestone = deal?.milestones.find((m) => m.id === milestoneId);
  if (!deal || !milestone) return jsonError("Milestone not found", 404);

  const blocker = freelancerCancelBlocker(milestone);
  if (blocker) return jsonError(blocker, 409);

  try {
    return Response.json(await refundMilestone(deal, milestone, "freelancer"));
  } catch (err) {
    return handleError(err);
  }
}
