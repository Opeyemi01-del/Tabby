// POST /api/deals/{id}/milestones/{milestoneId}/approve   { key? }
// The CLIENT approves the delivered work -> PayPal releases the money.
// Requires the secret review key given to whoever paid (from their
// cookie, or from the private review link).
import { handleError, jsonError, readJson } from "@/lib/api";
import { getClientKey, isValidClientKey, setClientKeyCookie } from "@/lib/client-key";
import { findDeal } from "@/lib/db";
import { releaseMilestone } from "@/lib/release";

export async function POST(req: Request, ctx: RouteContext<"/api/deals/[id]/milestones/[milestoneId]/approve">) {
  const { id, milestoneId } = await ctx.params;
  const deal = findDeal(id);
  const milestone = deal?.milestones.find((m) => m.id === milestoneId);
  if (!deal || !milestone) return jsonError("Milestone not found", 404);

  const body = await readJson(req);
  const key = await getClientKey(deal.id, typeof body.key === "string" ? body.key : null);
  if (!isValidClientKey(deal, key)) return jsonError("Only the client who paid can approve this work", 403);
  if (milestone.status !== "work_submitted") return jsonError("There's no delivered work waiting for approval", 409);

  try {
    await setClientKeyCookie(deal.id, key!); // remember them on this device
    return Response.json(await releaseMilestone(deal, milestone, "client"));
  } catch (err) {
    return handleError(err);
  }
}
