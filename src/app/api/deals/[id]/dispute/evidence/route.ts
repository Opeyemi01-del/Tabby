// POST /api/deals/{id}/dispute/evidence            -> AI builds the evidence pack
// POST /api/deals/{id}/dispute/evidence?submit=1   -> also sends it to PayPal
// The freelancer can review the pack first, then submit.
import { buildEvidence } from "@/lib/ai";
import { handleError, jsonError } from "@/lib/api";
import { findDeal, saveDeal } from "@/lib/db";
import { provideDisputeEvidence } from "@/lib/paypal";

export async function POST(req: Request, ctx: RouteContext<"/api/deals/[id]/dispute/evidence">) {
  const { id } = await ctx.params;
  const deal = findDeal(id);
  if (!deal?.dispute) return jsonError("No dispute on this deal", 404);

  const dispute = deal.dispute;
  const milestone = deal.milestones.find((m) => m.id === dispute.milestoneId);
  if (!milestone) return jsonError("Disputed milestone not found", 404);

  const submit = new URL(req.url).searchParams.get("submit") === "1";

  try {
    // Build the pack if we don't have one yet.
    if (dispute.evidence.length === 0) {
      dispute.evidence = await buildEvidence(deal, milestone, dispute.reason);
      saveDeal(deal);
    }

    if (submit) {
      if (dispute.status !== "open") return jsonError("Evidence was already submitted", 409);
      const notes = dispute.evidence.map((e, i) => `${i + 1}. ${e.title}: ${e.detail}`).join("\n");
      await provideDisputeEvidence(dispute.id, notes);
      dispute.status = "evidence_submitted";
      saveDeal(deal);
    }

    return Response.json({ evidence: dispute.evidence, status: dispute.status });
  } catch (err) {
    return handleError(err);
  }
}
