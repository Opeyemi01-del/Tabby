// PAYPAL — every call Tabby makes to PayPal lives here.
// Talks to PayPal's REST API directly (no SDK to install).
// Uses the SANDBOX by default: fake money, test accounts.
// Server-only: it uses the secret key, so never import it in "use client" files.
//
// The money flow:
//   1. createHoldOrder      client starts paying (intent AUTHORIZE = hold, not take)
//   2. authorizeOrder       after the client approves, PayPal reserves the money
//   3. captureAuthorization work approved -> money actually moves to the freelancer
//      (or voidAuthorization to cancel the hold and free the client's money)
// PayPal honors an authorization for 3 days and lets you capture it for
// up to 29 days, so milestones should fit inside that window.

const BASE = process.env.PAYPAL_API_BASE ?? "https://api-m.sandbox.paypal.com";

export class PayPalError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
  }
}

// --- Authentication -------------------------------------------------------

let cachedToken: { value: string; expiresAt: number } | undefined;

// Swaps the Client ID + Secret for a short-lived access token (cached).
async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.value;

  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) {
    throw new PayPalError("PayPal keys missing: set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in .env.local", 500);
  }

  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new PayPalError("Could not log in to PayPal — check your sandbox keys", res.status);

  const data = (await res.json()) as { access_token: string; expires_in: number };
  // Refresh a minute early to be safe.
  cachedToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return data.access_token;
}

// Sends an authenticated JSON request and turns PayPal errors into PayPalError.
async function paypalRequest<T>(
  path: string,
  options: { method?: string; body?: unknown; requestId?: string; prefer?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${await getAccessToken()}`,
    "Content-Type": "application/json",
  };
  // Same requestId twice = PayPal does the action only once (protects
  // against double-charging if a request is retried).
  if (options.requestId) headers["PayPal-Request-Id"] = options.requestId;
  if (options.prefer) headers.Prefer = options.prefer;

  const res = await fetch(`${BASE}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const message = data.details?.[0]?.description ?? data.message ?? `PayPal request failed (${res.status})`;
    throw new PayPalError(message, res.status, data);
  }
  return data as T;
}

// --- Payments: hold, release, cancel -------------------------------------

// Step 1: create an order that HOLDS the money instead of taking it.
// Returns the order id the PayPal button needs.
export async function createHoldOrder(input: {
  amount: number;
  currency: string;
  description: string;
  referenceId: string; // our own id, e.g. "d-1003:m-1"
}): Promise<string> {
  const order = await paypalRequest<{ id: string }>("/v2/checkout/orders", {
    method: "POST",
    body: {
      intent: "AUTHORIZE",
      purchase_units: [
        {
          reference_id: input.referenceId,
          custom_id: input.referenceId,
          description: input.description.slice(0, 127),
          amount: { currency_code: input.currency, value: input.amount.toFixed(2) },
        },
      ],
    },
  });
  return order.id;
}

// Step 2: after the client approves in the PayPal popup, reserve the money.
export async function authorizeOrder(orderId: string): Promise<{ authorizationId: string; status: string }> {
  const order = await paypalRequest<{
    purchase_units: { payments?: { authorizations?: { id: string; status: string }[] } }[];
  }>(`/v2/checkout/orders/${encodeURIComponent(orderId)}/authorize`, {
    method: "POST",
    body: {},
    requestId: `authorize-${orderId}`,
  });
  const auth = order.purchase_units[0]?.payments?.authorizations?.[0];
  if (!auth) throw new PayPalError("PayPal did not return an authorization", 502, order);
  return { authorizationId: auth.id, status: auth.status };
}

// Step 3: release the held money. `netAmount` is what actually arrives
// after PayPal's fee — that's what we can forward to the freelancer.
export async function captureAuthorization(
  authorizationId: string,
): Promise<{ captureId: string; status: string; netAmount?: number }> {
  const capture = await paypalRequest<{
    id: string;
    status: string;
    seller_receivable_breakdown?: { net_amount?: { value: string } };
  }>(`/v2/payments/authorizations/${encodeURIComponent(authorizationId)}/capture`, {
    method: "POST",
    body: { final_capture: true },
    requestId: `capture-${authorizationId}`,
    prefer: "return=representation", // ask for the full details, including the fee breakdown
  });
  const net = Number(capture.seller_receivable_breakdown?.net_amount?.value);
  return { captureId: capture.id, status: capture.status, netAmount: Number.isFinite(net) ? net : undefined };
}

// --- Payouts: forward the money to the freelancer's own PayPal -----------

// Sends money to a PayPal account by email. `batchKey` must be unique per
// payment: PayPal refuses a second batch with the same key, so a retry can
// never pay the freelancer twice.
export async function createPayout(input: {
  email: string;
  amount: number;
  note: string;
  batchKey: string;
}): Promise<{ batchId: string; status: string }> {
  const result = await paypalRequest<{ batch_header: { payout_batch_id: string; batch_status: string } }>(
    "/v1/payments/payouts",
    {
      method: "POST",
      body: {
        sender_batch_header: {
          sender_batch_id: input.batchKey,
          email_subject: "You've been paid through Tabby",
          email_message: input.note,
        },
        items: [
          {
            recipient_type: "EMAIL",
            receiver: input.email,
            amount: { value: input.amount.toFixed(2), currency: "USD" },
            note: input.note.slice(0, 4000),
            sender_item_id: input.batchKey,
          },
        ],
      },
    },
  );
  return { batchId: result.batch_header.payout_batch_id, status: result.batch_header.batch_status };
}

// Current state of a payout batch, e.g. PENDING, PROCESSING, SUCCESS, DENIED.
export async function getPayoutStatus(batchId: string): Promise<string> {
  const result = await paypalRequest<{ batch_header: { batch_status: string } }>(
    `/v1/payments/payouts/${encodeURIComponent(batchId)}`,
  );
  return result.batch_header.batch_status;
}

// Cancel a hold (e.g. the deal is called off) — the client keeps their money.
export async function voidAuthorization(authorizationId: string): Promise<void> {
  await paypalRequest(`/v2/payments/authorizations/${encodeURIComponent(authorizationId)}/void`, {
    method: "POST",
    requestId: `void-${authorizationId}`,
  });
}

// --- Disputes -------------------------------------------------------------

export type PayPalDispute = {
  dispute_id: string;
  reason: string;
  status: string;
  create_time: string;
  disputed_transactions?: { seller_transaction_id?: string }[];
};

export async function getDispute(disputeId: string): Promise<PayPalDispute> {
  return paypalRequest<PayPalDispute>(`/v1/customer/disputes/${encodeURIComponent(disputeId)}`);
}

// Sends our written evidence to PayPal for a dispute.
// PayPal expects a multipart form with a JSON part named "input".
// (Verify the accepted evidence_type values in sandbox testing.)
export async function provideDisputeEvidence(disputeId: string, notes: string): Promise<void> {
  const form = new FormData();
  form.append(
    "input",
    new Blob([JSON.stringify({ evidences: [{ evidence_type: "OTHER", notes: notes.slice(0, 2000) }] })], {
      type: "application/json",
    }),
  );

  const res = await fetch(`${BASE}/v1/customer/disputes/${encodeURIComponent(disputeId)}/provide-evidence`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await getAccessToken()}` },
    body: form,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new PayPalError(data.message ?? `Could not submit evidence (${res.status})`, res.status, data);
  }
}

// --- Webhooks -------------------------------------------------------------

// Asks PayPal to confirm a webhook really came from PayPal (not a forger).
export async function verifyWebhook(headers: Headers, rawBody: string): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) throw new PayPalError("PAYPAL_WEBHOOK_ID is not set", 500);

  const result = await paypalRequest<{ verification_status: string }>(
    "/v1/notifications/verify-webhook-signature",
    {
      method: "POST",
      body: {
        auth_algo: headers.get("paypal-auth-algo"),
        cert_url: headers.get("paypal-cert-url"),
        transmission_id: headers.get("paypal-transmission-id"),
        transmission_sig: headers.get("paypal-transmission-sig"),
        transmission_time: headers.get("paypal-transmission-time"),
        webhook_id: webhookId,
        webhook_event: JSON.parse(rawBody),
      },
    },
  );
  return result.verification_status === "SUCCESS";
}
