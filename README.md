# Tabby

**Get paid for every milestone — and prove the work was done.**

Tabby holds a client's payment with PayPal until the work is delivered, uses AI to check the delivery against what was agreed, and defends the freelancer if the client later disputes the payment.

- **Live demo:** https://tabby-cx16.onrender.com (PayPal sandbox — no real money)
- **Demo video:** _coming soon_
- Built for the [PayPal AI Hackathon](https://paypalaihackathon.devpost.com)

---

## The problem

Freelancers and artisans are asked to trust strangers. Either they work first and chase the money, or the client pays first and hopes the work gets done. Disputes come weeks later, when the chat, the files and the dates are scattered across phones.

It's harder still for the diaspora. Someone in London who pays a cleaner, plumber or tailor to do a job at their family's home in Lagos can't see the work — and many Nigerian PayPal accounts historically couldn't receive payments at all.

## How Tabby works

1. **Chat → deal.** Paste the client conversation, or upload WhatsApp screenshots. AI drafts the deal: client, milestones, amounts, due dates, and whether it's digital or on-site work.
2. **The client pays — PayPal holds it.** Each milestone is a PayPal order with `intent: AUTHORIZE`: the money is reserved on the client's account, not sent.
3. **The work is delivered — AI checks the real thing.** Files are fingerprinted (SHA-256), links are fetched by the server, and the AI compares the actual content with the agreement. The freelancer's description alone can never count as "verified".
4. **The client approves — PayPal releases it.** Only the person who paid (holding a secret review key) can approve, or ask for fixes. If they stay silent past the review period, a delivery the AI verified can be released by the freelancer. The payment is captured and forwarded to the freelancer's own PayPal account with PayPal Payouts.
5. **If the client disputes,** PayPal's webhook tells Tabby, the AI builds an evidence pack from the deal's record, and Tabby sends it to PayPal.

### On-site jobs (paid from abroad)

For physical work — cleaning, repairs, tailoring — Tabby adds proof from the place itself:

- **Before/after photos** taken with the phone camera when the job starts and ends. The AI checks that they show the same place and that the agreed change is visible. Photos taken long before upload are flagged.
- **A completion code.** The payer gets a 6-digit code and sends it to someone at the place (family, a neighbour). That person gives it to the artisan only when they're happy, confirming the job on-site — the payer still approves the payment.
- **A materials milestone** for supplies bought before the job starts, confirmed the same way.
- **Naira amounts** shown next to dollars.

### Dispute Shield

Every step — agreement, payment, delivery, AI check, approval, payout, dispute — is recorded in a timeline where each entry includes the fingerprint of the one before it. Editing or deleting any past step breaks the chain, and the page says so. Paid milestones get a public **delivery certificate** (fingerprints, dates, who approved — no private files).

---

## Try it

Open the [live demo](https://tabby-cx16.onrender.com). The home page has a **Try it** section with:

- **Sample deals** to look around without signing in: an on-site room clean paid from abroad (with photos, codes and a certificate), digital work waiting for the client's review, and a dispute. Sample deals have no real payment behind them, so their money buttons explain that instead of acting; the sample dispute's submission is simulated.
- **A real run in the PayPal sandbox** (about 5 minutes): New deal → pick a sample chat → pay with the sandbox buyer login shown on the home page → deliver a file or photos → approve on the client's review page.

> The demo runs on Render's free plan: the first visit after a quiet spell can take up to a minute, and deals you create are cleared when the server restarts. The sample deals always come back.

---

## How PayPal is used

| PayPal API | What Tabby does with it |
|---|---|
| **JavaScript SDK** (Smart Buttons) | The client's checkout on the payment page |
| **Orders v2** — create with `intent: AUTHORIZE`, then authorize | Holds each milestone's payment instead of taking it |
| **Payments v2** — capture / void an authorization | Releases the money on approval, or cancels the hold for a refund |
| **Payouts** | Forwards the captured payment to the freelancer's own PayPal account |
| **Webhooks** + signature verification | Learns about disputes, completed captures, payouts and voided holds — every event is verified with PayPal first |
| **Disputes** — get, send message, provide evidence | Answers a dispute with the AI evidence pack, in the way PayPal allows at the dispute's current stage |

PayPal authorizations are honoured for 3 days and can be captured for up to 29, so milestone due dates are limited to 29 days.

## How AI is used

Tabby uses Google **Gemini** (through one small module, `src/lib/ai/`, so the provider can be swapped):

1. **Extract a deal** from pasted chat text or chat screenshots, including a readable transcript and a warning for unreadable screenshots.
2. **Check a delivery** against the agreement, using the real files, fetched links, or before/after photos. It returns a verdict (`verified`, `claimed_only` or `concerns`) and a requirement-by-requirement checklist.
3. **Build dispute evidence** from facts only: the agreement, the delivery record, the AI check and the fingerprinted timeline.

Guardrails:

- Chats, notes and files are passed as data inside tags, and the AI is told never to follow instructions found in them.
- The code re-checks the AI's verdict: nothing is "verified" without inspectable evidence, or if any checklist item isn't met.
- The AI never moves money by itself. The client approves the release; only if they don't respond within the review period can the freelancer release a delivery the AI **verified** from real files.
- If the main model is slow, busy or out of quota, a backup model answers instead.

---

## Tools used

- **PayPal:** JavaScript SDK, Orders v2, Payments v2 (authorizations), Payouts, Webhooks, Disputes — all in the sandbox
- **Google Gemini API** — deal extraction, delivery checks, dispute evidence
- **Next.js 16** (App Router), **React 19**, **TypeScript**, **Tailwind CSS 4**
- **SQLite** (built into Node.js 22+, `node:sqlite`) for storage
- **Render** for hosting (`render.yaml` blueprint)

---

## Run it yourself

### You need

- **Node.js 22.13 or newer**
- A **PayPal developer account** with a sandbox REST app (Client ID and Secret), plus its sandbox business and personal test accounts — [developer.paypal.com](https://developer.paypal.com)
- A **Gemini API key** — [aistudio.google.com](https://aistudio.google.com)

### Steps

```bash
git clone https://github.com/Opeyemi01-del/Tabby.git
cd Tabby
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3000
```

### Settings (`.env.local`)

| Name | What it's for |
|---|---|
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | Your sandbox REST app |
| `PAYPAL_API_BASE` | `https://api-m.sandbox.paypal.com` |
| `PAYPAL_WEBHOOK_ID` | The webhook's ID (see below) — needed to verify events |
| `GEMINI_API_KEY` | Gemini API key |
| `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL` | Main and backup model names |
| `NGN_PER_USD` | Naira per dollar for the ≈ ₦ amounts (optional) |
| `REVIEW_PERIOD_HOURS`, `FIX_PERIOD_HOURS` | Client review and fix windows (default 72; use `0.05` for a 3-minute demo) |
| `DEMO_BUYER_EMAIL`, `DEMO_BUYER_PASSWORD` | Sandbox buyer login shown on the home page (optional, test account only) |
| `DATABASE_PATH`, `UPLOAD_DIR` | Where the database and uploads are stored (optional) |

### Webhooks

PayPal can only send webhooks to a public HTTPS address, so dispute and payout events need a deployed copy (or a tunnel). In your sandbox app, add a webhook to `https://<your-site>/api/paypal/webhook` for these events, then put its ID in `PAYPAL_WEBHOOK_ID`:

`CUSTOMER.DISPUTE.CREATED`, `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.AUTHORIZATION.VOIDED`, `PAYMENT.PAYOUTSBATCH.SUCCESS`, `PAYMENT.PAYOUTSBATCH.DENIED`

### Deploy to Render

On [render.com](https://render.com): **New → Blueprint** → pick this repository. Render reads `render.yaml` and asks for the secret values.

---

## Project layout

```
src/app/            pages (dashboard, new deal, pay, review, disputes, certificate) and API routes
src/lib/paypal.ts   every PayPal call
src/lib/ai/         the AI jobs (index.ts) and the Gemini connector (gemini.ts)
src/lib/release.ts  who may release or refund money, and when
src/lib/onsite.ts   completion codes and before/after photos
src/lib/events.ts   Dispute Shield's fingerprint chain
src/lib/sample-data.ts  the built-in sample deals
demo-files/         photos and files used by the sample deals
```

## Limitations

- Sandbox only; there are no user accounts yet — the freelancer's pages are open, and the client is recognised by a secret review key.
- On Render's free plan the database and uploads live on a disk that is wiped on restart.
- A photo's "taken at" time comes from the phone, so it catches casual reuse of old photos, not a determined forger.
- The AI can be wrong. That's why it never releases money on its own.

## License

[MIT](LICENSE)
