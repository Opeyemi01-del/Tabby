// POST /api/paypal/orders/{orderId}/authorize
// Called after the client approves in the PayPal popup.
// Reserves (holds) the money and marks the milestone "funds_held".
// The first time a deal is paid, the payer also gets a secret review key
// (cookie + private link) — only they can approve releasing the money.
import { handleError, jsonError } from "@/lib/api";
import { newClientKey, setClientKeyCookie } from "@/lib/client-key";
import { findByPaypalOrder, saveDeal } from "@/lib/db";
import { authorizeOrder } from "@/lib/paypal";

export async function POST(_req: Request, ctx: RouteContext<"/api/paypal/orders/[orderId]/authorize">) {
  const { orderId } = await ctx.params;
  const found = findByPaypalOrder(orderId);
  if (!found) return jsonError("Unknown PayPal order", 404);

  const { deal, milestone } = found;
  if (milestone.status !== "awaiting_payment") return jsonError("This milestone is already paid", 409);

  try {
    const { authorizationId, status } = await authorizeOrder(orderId);
    if (status !== "CREATED") return jsonError(`PayPal could not hold the funds (status ${status})`, 502);

    milestone.authorizationId = authorizationId;
    milestone.status = "funds_held";

    // Only the FIRST payer gets a key. Paying a later milestone doesn't
    // hand out a new one, so nobody can "buy" approval rights.
    let reviewUrl: string | undefined;
    if (!deal.clientKeyHash) {
      const { key, keyHash } = newClientKey();
      deal.clientKeyHash = keyHash;
      await setClientKeyCookie(deal.id, key);
      reviewUrl = `/review/${deal.id}?key=${key}`;
    }

    saveDeal(deal);
    return Response.json({ ok: true, dealId: deal.id, milestoneId: milestone.id, reviewUrl });
  } catch (err) {
    return handleError(err);
  }
}
