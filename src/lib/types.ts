// The shapes of Tabby's data. If you add a field here (e.g. a phone
// number on a deal), TypeScript will point out every place that needs it.

// Where a milestone (or a whole deal) is in its life:
//   awaiting_payment -> client hasn't paid yet
//   funds_held       -> client paid; PayPal is holding the money
//   work_submitted   -> freelancer delivered; AI has checked it
//   released         -> money sent to the freelancer
//   disputed         -> client opened a PayPal dispute
export type Status =
  | "awaiting_payment"
  | "funds_held"
  | "work_submitted"
  | "released"
  | "disputed";

// The AI's verdict after comparing delivered work with the agreement.
export type AiCheck = {
  verdict: "pass" | "concerns";
  summary: string;
};

export type Milestone = {
  id: string;
  title: string;
  amount: number;
  dueDate: string; // ISO date, e.g. "2026-10-20"
  status: Status;
  deliveryNote?: string; // what the freelancer submitted
  aiCheck?: AiCheck;
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

export type Deal = {
  id: string;
  title: string;
  clientName: string;
  clientEmail: string;
  currency: "USD";
  createdAt: string;
  agreement: string; // the client chat the deal was created from
  milestones: Milestone[];
  dispute?: Dispute;
};
