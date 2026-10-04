// The shapes of Tabby's data. If you add a field here (e.g. a phone
// number on a deal), TypeScript will point out every place that needs it.

// Where a milestone (or a whole deal) is in its life:
//   awaiting_payment -> client hasn't paid yet
//   funds_held       -> client paid; PayPal is holding the money
//   work_submitted   -> freelancer delivered; waiting for the CLIENT to approve
//   released         -> money sent to the freelancer
//   refunded         -> cancelled: PayPal's hold was released back to the client
//   disputed         -> client opened a PayPal dispute
export type Status =
  | "awaiting_payment"
  | "funds_held"
  | "work_submitted"
  | "released"
  | "refunded"
  | "disputed";

// The AI's verdict after comparing delivered work with the agreement:
//   verified     -> AI opened the actual files/links and they match
//   claimed_only -> nothing it could inspect; it's only the freelancer's word
//   concerns     -> what it inspected is missing something or doesn't match
export type Verdict = "verified" | "claimed_only" | "concerns";

// One line of the AI's checklist, e.g. "SVG files" -> met: "yes".
export type CheckItem = {
  requirement: string;
  met: "yes" | "no" | "unclear";
  note: string;
};

export type AiCheck = {
  verdict: Verdict;
  summary: string;
  checklist?: CheckItem[];
};

// Something the freelancer handed in: an uploaded file or a link.
export type Deliverable = {
  id: string; // random, also used in the download URL
  kind: "file" | "link";
  name: string; // file name, or the link itself
  mimeType?: string;
  size?: number; // bytes
  sha256?: string; // fingerprint: proves the file wasn't changed later
  aiReadable: boolean; // could the AI actually open it?
  aiNote?: string; // why not, if it couldn't
};

// After the client's payment is captured, Tabby forwards it to the
// freelancer's own PayPal account with PayPal Payouts.
export type Payout = {
  status: "pending" | "sent" | "failed";
  amount: number;
  batchId?: string; // PayPal's payout batch id
  error?: string; // why it failed (shown with a "Try again" button)
};

// "work" = something is delivered. "materials" = money for parts, paid
// before an on-site job starts (released when the client confirms it began).
export type MilestoneKind = "work" | "materials";

// "digital" = files/links (design, writing...). "onsite" = physical work at
// a place (plumbing, wiring, repairs...), proven with before/after photos.
export type JobType = "digital" | "onsite";

export type Milestone = {
  id: string;
  kind?: MilestoneKind; // missing = "work"
  title: string;
  amount: number;
  dueDate: string; // ISO date, e.g. "2026-10-20"
  status: Status;
  deliveryNote?: string; // what the freelancer submitted
  deliverables?: Deliverable[];
  submittedAt?: string; // ISO date-time of the latest submission
  aiCheck?: AiCheck;
  // Client review (layer 1): only the person who paid can approve.
  reviewDeadline?: string; // after this, a "verified" delivery can be released
  clientFeedback?: string; // set when the client asks for changes
  fixDeadline?: string; // after this, the client may cancel if no fix arrived
  releasedBy?: "client" | "auto"; // who triggered the payout
  netAmount?: number; // what Tabby actually received after PayPal's fee
  payout?: Payout; // sending the money on to the freelancer's own PayPal
  refundedBy?: "client" | "freelancer"; // who cancelled the hold
  // PayPal references, filled in as the payment moves along:
  paypalOrderId?: string; // created when the client starts paying
  authorizationId?: string; // the "hold" on the client's money
  captureId?: string; // the actual payment to the freelancer
};

// One item in the evidence pack the AI builds for a dispute.
export type EvidenceItem = {
  title: string;
  detail: string;
};

export type Dispute = {
  id: string;
  milestoneId: string;
  reason: string;
  openedAt: string;
  status: "open" | "evidence_submitted" | "won" | "lost";
  evidence: EvidenceItem[];
};

// DISPUTE SHIELD — one step in a deal's history (the timeline).
// Each event stores the fingerprint of the event before it, forming a
// chain: changing or deleting any past event breaks every link after it.
export type EventType =
  | "deal_created"
  | "payment_held"
  | "work_submitted"
  | "ai_checked"
  | "changes_requested"
  | "released"
  | "refunded"
  | "payout_sent"
  | "dispute_opened"
  | "evidence_submitted";

export type DealEvent = {
  type: EventType;
  at: string; // ISO date-time
  milestoneId?: string;
  summary: string; // human-readable, e.g. "Client paid $150 — held by PayPal"
  proof?: string[]; // e.g. PayPal IDs, file fingerprints
  prevHash: string; // fingerprint of the previous event ("" for the first)
  hash: string; // fingerprint of this event (including prevHash)
};

export type Deal = {
  id: string;
  title: string;
  clientName: string;
  clientEmail: string;
  currency: "USD";
  createdAt: string;
  agreement: string; // the client chat the deal was created from
  // The freelancer's PayPal email — where their money is sent. Set only
  // when the deal is created (there are no logins yet, so allowing changes
  // later would let anyone redirect the money).
  payoutEmail?: string;
  jobType?: JobType; // missing = "digital"
  jobLocation?: string; // on-site only: the area, e.g. "Surulere, Lagos" (no full address)
  milestones: Milestone[];
  // Fingerprint (SHA-256) of the secret review key given to whoever paid.
  // The key itself is never stored, so even the database can't leak it.
  clientKeyHash?: string;
  // Original chat screenshots (private: used only as dispute evidence).
  agreementFiles?: Deliverable[];
  // Dispute Shield history, oldest first.
  events?: DealEvent[];
  dispute?: Dispute;
};
