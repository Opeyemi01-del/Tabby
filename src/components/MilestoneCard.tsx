"use client";
// One milestone on the deal page, with the right action for its status:
//   awaiting_payment -> link to the client's payment page
//   funds_held       -> form to submit work for the AI check
//   work_submitted   -> AI result + "Release funds" button
//   released / disputed -> just shows the outcome
import { useState } from "react";
import Link from "next/link";
import StatusBadge from "./StatusBadge";
import { checkDelivery } from "@/lib/mock-ai";
import { formatDate, formatMoney } from "@/lib/format";
import type { AiCheck, Milestone } from "@/lib/types";

export default function MilestoneCard({ dealId, milestone }: { dealId: string; milestone: Milestone }) {
  const [status, setStatus] = useState(milestone.status);
  const [aiCheck, setAiCheck] = useState<AiCheck | undefined>(milestone.aiCheck);
  const [note, setNote] = useState("");
  const [checking, setChecking] = useState(false);

  async function handleSubmitWork() {
    setChecking(true);
    const result = await checkDelivery(note);
    setAiCheck(result);
    setChecking(false);
    if (result.verdict === "pass") setStatus("work_submitted");
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
            onClick={handleSubmitWork}
            disabled={checking || note.trim() === ""}
            className="mt-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {checking ? "AI is checking the work…" : "Submit work for AI check"}
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
          onClick={() => setStatus("released")}
          className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Release funds (demo)
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
    </div>
  );
}
