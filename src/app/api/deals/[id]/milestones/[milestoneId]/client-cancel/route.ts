// POST /api/deals/{id}/milestones/{milestoneId}/client-cancel   { key? }
// The CLIENT gets their money back because the freelancer missed a
// deadline (no delivery by the due date, or no fix in the fix period).
// Requires the client's secret review key.
import { handleError, jsonError, readJson } from "@/lib/api";
import { getClientKey, isValidClientKey } from "@/lib/client-key";
import { findDeal } from "@/lib/db";
import { clientCancelBlocker, refundMilestone } from "@/lib/release";

export async function POST(req: Request, ctx: RouteContext<"/api/deals/[id]/milestones/[milestoneId]/client-cancel">) {
  const { id, milestoneId } = await ctx.params;
  const deal = findDeal(id);
  const milestone = deal?.milestones.find((m) => m.id === milestoneId);
  if (!deal || !milestone) return jsonError("Milestone not found", 404);

  const body = await readJson(req);
  const key = await getClientKey(deal.id, typeof body.key === "string" ? body.key : null);
  if (!isValidClientKey(deal, key)) return jsonError("Only the client who paid can cancel this payment", 403);

  const blocker = clientCancelBlocker(milestone);
  if (blocker) return jsonError(blocker, 409);

  try {
    return Response.json(await refundMilestone(deal, milestone, "client"));
  } catch (err) {
    return handleError(err);
  }
}
