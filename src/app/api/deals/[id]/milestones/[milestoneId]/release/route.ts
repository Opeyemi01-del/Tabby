// POST /api/deals/{id}/milestones/{milestoneId}/release
// The FREELANCER's release button. Only works when the client stayed silent:
// the review period has ended AND the AI verified the actual files.
// (While reviewing, the client approves via .../approve instead.)
import { handleError, jsonError, sampleOnly } from "@/lib/api";
import { findDeal } from "@/lib/db";
import { autoReleaseBlocker, releaseMilestone } from "@/lib/release";

export async function POST(_req: Request, ctx: RouteContext<"/api/deals/[id]/milestones/[milestoneId]/release">) {
  const { id, milestoneId } = await ctx.params;
  const deal = findDeal(id);
  const milestone = deal?.milestones.find((m) => m.id === milestoneId);
  if (!deal || !milestone) return jsonError("Milestone not found", 404);
  if (deal.sample) return sampleOnly();

  const blocker = autoReleaseBlocker(milestone);
  if (blocker) return jsonError(blocker, 409);

  try {
    return Response.json(await releaseMilestone(deal, milestone, "auto"));
  } catch (err) {
    return handleError(err);
  }
}
