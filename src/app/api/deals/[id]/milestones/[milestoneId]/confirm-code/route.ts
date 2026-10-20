// POST /api/deals/{id}/milestones/{milestoneId}/confirm-code   { code }
// The ARTISAN enters the completion code the person at the place gave them.
// Knowing the code is the proof, so no key is needed — but after 5 wrong
// tries the code locks, so it can't be guessed.
// A right code marks the job "confirmed on-site"; the payer still approves.
import { jsonError, readJson } from "@/lib/api";
import { findDeal, saveDeal } from "@/lib/db";
import { addEvent } from "@/lib/events";
import { codeBlocker, codeConfirms, codeMatches, MAX_CODE_TRIES } from "@/lib/onsite";

export async function POST(req: Request, ctx: RouteContext<"/api/deals/[id]/milestones/[milestoneId]/confirm-code">) {
  const { id, milestoneId } = await ctx.params;
  const deal = findDeal(id);
  const milestone = deal?.milestones.find((m) => m.id === milestoneId);
  if (!deal || !milestone) return jsonError("Milestone not found", 404);

  const blocker = codeBlocker(deal, milestone);
  if (blocker) return jsonError(blocker, 409);

  const body = await readJson(req);
  const code = typeof body.code === "string" ? body.code : "";
  if (!/^\s*\d{6}\s*$/.test(code)) return jsonError("The code is 6 digits");

  if (!codeMatches(milestone, code)) {
    milestone.codeTries = (milestone.codeTries ?? 0) + 1;
    saveDeal(deal);
    const left = MAX_CODE_TRIES - milestone.codeTries;
    return jsonError(
      left > 0
        ? `That code isn't right — ${left} ${left === 1 ? "try" : "tries"} left`
        : "That code isn't right, and it's now locked. The payer can still approve from their review page.",
      403,
    );
  }

  milestone.confirmedOnsiteAt = new Date().toISOString();
  addEvent(deal, {
    type: "onsite_confirmed",
    milestoneId: milestone.id,
    summary: `Confirmed on-site that ${codeConfirms(milestone)}: the person at the place gave the artisan the code for "${milestone.title}"`,
  });
  saveDeal(deal);
  return Response.json({ confirmedOnsiteAt: milestone.confirmedOnsiteAt });
}
