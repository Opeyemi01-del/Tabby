"use client";
// One milestone on the FREELANCER's deal page, with the right action for its status:
//   awaiting_payment -> link to the client's payment page
//   funds_held       -> upload files/links; the AI inspects the real work
//   work_submitted   -> waiting for the client to approve (or, if the AI
//                       verified the files and the review period ended,
//                       the freelancer may release the funds)
//   released / disputed -> just shows the outcome
// After an action, router.refresh() reloads the deal from the database.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import StatusBadge from "./StatusBadge";
import AiCheckBox from "./AiCheckBox";
import DeliverableList from "./DeliverableList";
import { postForm, postJson } from "@/lib/client-api";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import type { Milestone } from "@/lib/types";

type Props = {
  dealId: string;
  clientName: string;
  milestone: Milestone;
  releaseReady: boolean; // worked out on the server: verified + review period over
};

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none";

export default function MilestoneCard({ dealId, clientName, milestone, releaseReady }: Props) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [links, setLinks] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState<"" | "checking" | "releasing">("");
  const [error, setError] = useState("");

  const { status, aiCheck, deliverables = [] } = milestone;
  const apiBase = `/api/deals/${dealId}/milestones/${milestone.id}`;

  // Sends the work: note + files + links (one per line).
  async function handleSubmit() {
    const form = new FormData();
    form.append("deliveryNote", note);
    files.forEach((f) => form.append("files", f));
    links
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .forEach((l) => form.append("links", l));

    setBusy("checking");
    setError("");
    try {
      await postForm(`${apiBase}/submit`, form);
      setNote("");
      setLinks("");
      setFiles([]);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy("");
  }

  async function handleRelease() {
    setBusy("releasing");
    setError("");
    try {
      await postJson(`${apiBase}/release`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy("");
  }

  const nothingToSend = files.length === 0 && links.trim() === "";

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
          {/* Feedback from the client, or the AI's concerns about the last attempt */}
          {milestone.clientFeedback && (
            <div className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              <span className="font-semibold">{clientName} asked for changes:</span>
              <p className="mt-1 whitespace-pre-wrap">{milestone.clientFeedback}</p>
            </div>
          )}
          {aiCheck && (
            <>
              <DeliverableList dealId={dealId} items={deliverables} />
              <AiCheckBox check={aiCheck} />
            </>
          )}

          <p className="mt-3 text-sm text-slate-600">
            The client&apos;s money is held. Upload the actual work — the AI checks the real files, not just your
            description.
          </p>

          <label className="mt-3 block text-sm font-medium">
            Files <span className="font-normal text-slate-500">(images, PDF, text, SVG — up to 5 files, 8 MB each)</span>
            <input
              type="file"
              multiple
              accept=".png,.jpg,.jpeg,.webp,.pdf,.txt,.md,.csv,.json,.html,.css,.svg,.zip,.docx,.fig"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              className="mt-1 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2"
            />
          </label>

          <label className="mt-3 block text-sm font-medium">
            Links <span className="font-normal text-slate-500">(live site, public Google Doc, repo — one per line)</span>
            <textarea
              rows={2}
              value={links}
              onChange={(e) => setLinks(e.target.value)}
              placeholder="https://"
              className={`${inputClass} font-mono`}
            />
          </label>

          <label className="mt-3 block text-sm font-medium">
            Note to the client <span className="font-normal text-slate-500">(optional)</span>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything they should know about this delivery"
              className={inputClass}
            />
          </label>

          <button
            onClick={handleSubmit}
            disabled={busy !== "" || nothingToSend}
            className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {busy === "checking" ? "AI is inspecting the work…" : "Submit work for AI check"}
          </button>
        </div>
      )}

      {status === "work_submitted" && (
        <div className="mt-3">
          <DeliverableList dealId={dealId} items={deliverables} />
          {aiCheck && <AiCheckBox check={aiCheck} />}

          {releaseReady ? (
            <>
              <p className="mt-3 text-sm text-slate-600">
                {clientName} didn&apos;t respond during the review period, and the AI verified your files. You can
                release the funds.
              </p>
              <button
                onClick={handleRelease}
                disabled={busy !== ""}
                className="mt-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {busy === "releasing" ? "Releasing via PayPal…" : "Release funds"}
              </button>
            </>
          ) : (
            <p className="mt-3 rounded-lg bg-violet-50 p-3 text-sm text-violet-900">
              Waiting for {clientName} to approve.{" "}
              {aiCheck?.verdict === "verified" && milestone.reviewDeadline ? (
                <>
                  If they don&apos;t respond by{" "}
                  <span suppressHydrationWarning className="font-medium">
                    {formatDateTime(milestone.reviewDeadline)}
                  </span>
                  , you can release the funds yourself.
                </>
              ) : (
                "The AI couldn't verify the work from real files, so only the client can approve this payment."
              )}
            </p>
          )}
        </div>
      )}

      {status === "released" && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="text-brand-700">
            Paid to you ✓
            {milestone.releasedBy === "client" && " — approved by the client"}
            {milestone.releasedBy === "auto" && " — released after the review period"}
          </p>
          {milestone.releasedBy && (
            <Link
              href={`/certificate/${dealId}/${milestone.id}`}
              target="_blank"
              className="rounded-lg border border-brand-500 px-3 py-1.5 font-medium text-brand-700 hover:bg-brand-50"
            >
              🛡 View certificate
            </Link>
          )}
        </div>
      )}

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
