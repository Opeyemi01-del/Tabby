// POST /api/paypal/orders   { dealId }  ->  { orderId }
// Called by the PayPal button on the client's payment page.
// The amount always comes from our database, never from the browser.
import { handleError, jsonError, readJson } from "@/lib/api";
import { findDeal, saveDeal } from "@/lib/db";
import { createHoldOrder } from "@/lib/paypal";

export async function POST(req: Request) {
  const { dealId } = await readJson(req);
  const deal = typeof dealId === "string" ? findDeal(dealId) : undefined;
  if (!deal) return jsonError("Deal not found", 404);

  const milestone = deal.milestones.find((m) => m.status === "awaiting_payment");
  if (!milestone) return jsonError("Nothing to pay on this deal right now", 409);

  try {
    const orderId = await createHoldOrder({
      amount: milestone.amount,
      currency: deal.currency,
      description: `${deal.title} — ${milestone.title}`,
      referenceId: `${deal.id}:${milestone.id}`,
    });
    milestone.paypalOrderId = orderId;
    saveDeal(deal);
    return Response.json({ orderId });
  } catch (err) {
    return handleError(err);
  }
}
