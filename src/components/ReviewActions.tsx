"use client";
// The client's two buttons on the review page:
//   "Approve & release payment"  -> PayPal sends the money to the freelancer
//   "Request changes"            -> money stays held; freelancer gets the feedback
import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/client-api";
import { formatMoney } from "@/lib/format";

type Props = {
  dealId: string;
  milestoneId: string;
  amount: number;
  linkKey?: string; // the key from a private review link, if that's how they arrived
  flagged?: boolean; // the AI found problems: approving means "approve anyway"
};

export default function ReviewActions({ dealId, milestoneId, amount, linkKey, flagged }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"buttons" | "feedback">("buttons");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const apiBase = `/api/deals/${dealId}/milestones/${milestoneId}`;

  async function run(url: string, body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      await postJson(url, { ...body, key: linkKey });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  }

  return (
    <div className="mt-4">
      {mode === "buttons" ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            onClick={() => run(`${apiBase}/approve`, {})}
            disabled={busy}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? "Releasing via PayPal…" : `${flagged ? "Approve anyway" : "Approve"} & release ${formatMoney(amount)}`}
          </button>
          <button
            onClick={() => setMode("feedback")}
            disabled={busy}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Ask for fixes
          </button>
        </div>
      ) : (
        <div>
          <label className="text-sm font-medium" htmlFor={`fb-${milestoneId}`}>
            What needs to be fixed?
          </label>
          <p className="text-xs text-slate-500">
            Be specific — e.g. &ldquo;Template 2: make the logo bigger&rdquo;. Your payment stays held while they fix it.
          </p>
          <textarea
            id={`fb-${milestoneId}`}
            rows={4}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => run(`${apiBase}/request-changes`, { feedback })}
              disabled={busy || feedback.trim() === ""}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? "Sending…" : "Send to freelancer"}
            </button>
            <button onClick={() => setMode("buttons")} className="px-3 py-2 text-sm text-slate-600">
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}
