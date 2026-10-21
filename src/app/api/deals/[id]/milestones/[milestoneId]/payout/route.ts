// POST /api/deals/{id}/milestones/{milestoneId}/payout
// The freelancer's "Check payout" / "Try again" button.
//   pending -> asks PayPal whether it has arrived yet
//   failed  -> tries sending it again (to the email saved on the deal —
//              this route can never change where the money goes)
import { handleError, jsonError, sampleOnly } from "@/lib/api";
import { findDeal } from "@/lib/db";
import { refreshPayout, sendPayout } from "@/lib/payout";

export async function POST(_req: Request, ctx: RouteContext<"/api/deals/[id]/milestones/[milestoneId]/payout">) {
  const { id, milestoneId } = await ctx.params;
  const deal = findDeal(id);
  const milestone = deal?.milestones.find((m) => m.id === milestoneId);
  if (!deal || !milestone) return jsonError("Milestone not found", 404);
  if (deal.sample) return sampleOnly();
  if (milestone.status !== "released") return jsonError("This milestone hasn't been paid out yet", 409);
  if (!deal.payoutEmail) return jsonError("This deal has no PayPal email for payouts", 409);

  try {
    if (milestone.payout?.status === "pending") await refreshPayout(deal, milestone);
    else await sendPayout(deal, milestone);
    return Response.json({ payout: milestone.payout });
  } catch (err) {
    return handleError(err);
  }
}
