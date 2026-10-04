// POST /api/paypal/webhook — PayPal calls this when something happens
// (a dispute is opened, a payment completes, a hold is cancelled...).
// Every event is verified with PayPal first so nobody can fake one.
import { handleError, jsonError } from "@/lib/api";
import { findByPaypalPayment, saveDeal } from "@/lib/db";
import { addEvent } from "@/lib/events";
import { verifyWebhook } from "@/lib/paypal";

type WebhookEvent = {
  event_type: string;
  resource: {
    id?: string;
    dispute_id?: string;
    reason?: string;
    create_time?: string;
    disputed_transactions?: { seller_transaction_id?: string }[];
  };
};

export async function POST(req: Request) {
  const rawBody = await req.text();

  try {
    if (!(await verifyWebhook(req.headers, rawBody))) return jsonError("Invalid webhook signature", 401);
  } catch (err) {
    return handleError(err);
  }

  const event = JSON.parse(rawBody) as WebhookEvent;
  const r = event.resource;

  switch (event.event_type) {
    // A client opened a dispute on a payment we captured.
    case "CUSTOMER.DISPUTE.CREATED": {
      const captureId = r.disputed_transactions?.[0]?.seller_transaction_id;
      const found = captureId ? findByPaypalPayment(captureId) : undefined;
      if (found && r.dispute_id) {
        found.milestone.status = "disputed";
        found.deal.dispute = {
          id: r.dispute_id,
          milestoneId: found.milestone.id,
          reason: humanReason(r.reason),
          openedAt: (r.create_time ?? new Date().toISOString()).slice(0, 10),
          status: "open",
          evidence: [], // the AI builds this when the freelancer opens the dispute
        };
        addEvent(found.deal, {
          type: "dispute_opened",
          milestoneId: found.milestone.id,
          summary: `Client opened a PayPal dispute: ${found.deal.dispute.reason}`,
          proof: [`PayPal dispute ${r.dispute_id}`],
        });
        saveDeal(found.deal);
      }
      break;
    }

    // A capture that was PENDING has now completed.
    case "PAYMENT.CAPTURE.COMPLETED": {
      const found = r.id ? findByPaypalPayment(r.id) : undefined;
      if (found && found.milestone.status === "work_submitted") {
        found.milestone.status = "released";
        saveDeal(found.deal);
      }
      break;
    }

    // A hold was cancelled or expired: the client needs to pay again.
    case "PAYMENT.AUTHORIZATION.VOIDED": {
      const found = r.id ? findByPaypalPayment(r.id) : undefined;
      // Skip holds we cancelled ourselves (already "refunded").
      if (found && found.milestone.status !== "released" && found.milestone.status !== "refunded") {
        found.milestone.status = "awaiting_payment";
        found.milestone.authorizationId = undefined;
        found.milestone.paypalOrderId = undefined;
        saveDeal(found.deal);
      }
      break;
    }
  }

  // Always answer 200 so PayPal doesn't keep retrying events we ignore.
  return Response.json({ received: true });
}

// PayPal sends codes like "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED".
function humanReason(code?: string): string {
  const reasons: Record<string, string> = {
    MERCHANDISE_OR_SERVICE_NOT_RECEIVED: "Item not received",
    MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED: "Item not as described",
    UNAUTHORISED: "Unauthorised payment",
  };
  return code ? (reasons[code] ?? code.replaceAll("_", " ").toLowerCase()) : "Unknown reason";
}
