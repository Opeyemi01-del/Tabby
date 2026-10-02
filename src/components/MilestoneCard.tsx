"use client";
// One milestone on the deal page, with the right action for its status:
//   awaiting_payment -> link to the client's payment page
//   funds_held       -> form to submit work for the AI check
//   work_submitted   -> AI result + "Release funds" button (PayPal capture)
//   released / disputed -> just shows the outcome
// After an action, router.refresh() reloads the deal from the database.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import StatusBadge from "./StatusBadge";
import { postJson } from "@/lib/client-api";
import { formatDate, formatMoney } from "@/lib/format";
import type { Milestone } from "@/lib/types";

export default function MilestoneCard({ dealId, milestone }: { dealId: string; milestone: Milestone }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"" | "checking" | "releasing">("");
  const [error, setError] = useState("");

  const { status, aiCheck } = milestone;
  const apiBase = `/api/deals/${dealId}/milestones/${milestone.id}`;

  // Runs an action, shows any error, then reloads the page data.
  async function run(kind: "checking" | "releasing", url: string, body?: unknown) {
    setBusy(kind);
    setError("");
    try {
      await postJson(url, body);
      setNote("");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy("");
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium">{milestone.title}</p>
          <p className="text-sm text-slate-500">Due {formatDate(milestone.dueDate)}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <p className="font-semibold tabular-nums">{formatMoney(milestone.amount)}</p>
          <StatusBadge status={status} />
        </div>
      </div>

      {status === "awaiting_payment" && (
        <p className="mt-3 text-sm text-slate-600">
          Waiting for the client to pay.{" "}
          <Link href={`/pay/${dealId}`} className="font-medium text-brand-700 underline">
            Open payment page
          </Link>
        </p>
      )}

      {status === "funds_held" && (
        <div className="mt-3">
          <p className="text-sm text-slate-600">The client&apos;s money is held. Deliver the work, then submit it here.</p>
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What did you deliver? Add links to files or the live site."
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          <button
            onClick={() => run("checking", `${apiBase}/submit`, { deliveryNote: note })}
            disabled={busy !== "" || note.trim() === ""}
            className="mt-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {busy === "checking" ? "AI is checking the work…" : "Submit work for AI check"}
          </button>
        </div>
      )}

      {/* AI verdict box (shown whenever there is one, except after payment) */}
      {aiCheck && status !== "released" && (
        <div
          className={`mt-3 rounded-lg p-3 text-sm ${
            aiCheck.verdict === "pass" ? "bg-brand-50 text-brand-900" : "bg-amber-50 text-amber-900"
          }`}
        >
          <span className="font-semibold">AI check: {aiCheck.verdict === "pass" ? "Matches agreement" : "Needs attention"}</span>
          <p className="mt-1">{aiCheck.summary}</p>
        </div>
      )}

      {status === "work_submitted" && (
        <button
          onClick={() => run("releasing", `${apiBase}/release`)}
          disabled={busy !== ""}
          className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {busy === "releasing" ? "Releasing via PayPal…" : "Release funds"}
        </button>
      )}

      {status === "released" && <p className="mt-3 text-sm text-brand-700">Paid to you ✓</p>}

      {status === "disputed" && (
        <p className="mt-3 text-sm text-red-700">
          The client opened a dispute.{" "}
          <Link href="/disputes" className="font-medium underline">
            See the AI evidence pack
          </Link>
        </p>
      )}

      {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}
