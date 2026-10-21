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
import CancelButton from "./CancelButton";
import Naira from "./Naira";
import PayoutStatus from "./PayoutStatus";
import BeforeAfter from "./BeforeAfter";
import PhotoCapture, { appendShots, type Shot } from "./PhotoCapture";
import { postForm, postJson } from "@/lib/client-api";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import type { Milestone } from "@/lib/types";

type Props = {
  dealId: string;
  clientName: string;
  milestone: Milestone;
  releaseReady: boolean; // worked out on the server: verified + review period over
  hasPayoutEmail: boolean; // does the deal say where to send the freelancer's money?
  usesCode: boolean; // on-site jobs: confirmed with the completion code
  usesPhotos: boolean; // on-site work: proven with before/after photos instead of files
};

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none";

export default function MilestoneCard({ dealId, clientName, milestone, releaseReady, hasPayoutEmail, usesCode, usesPhotos }: Props) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [links, setLinks] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [beforeShots, setBeforeShots] = useState<Shot[]>([]);
  const [afterShots, setAfterShots] = useState<Shot[]>([]);
  const [retaking, setRetaking] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"" | "checking" | "releasing" | "confirming" | "starting">("");
  const [error, setError] = useState("");

  const { status, aiCheck, deliverables = [], beforePhotos = [] } = milestone;
  const apiBase = `/api/deals/${dealId}/milestones/${milestone.id}`;

  // Sends the work: note + files + links (one per line), or the after photos.
  async function handleSubmit() {
    const form = new FormData();
    form.append("deliveryNote", note);
    if (usesPhotos) {
      appendShots(form, afterShots);
    } else {
      files.forEach((f) => form.append("files", f));
      links
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .forEach((l) => form.append("links", l));
    }

    setBusy("checking");
    setError("");
    try {
      await postForm(`${apiBase}/submit`, form);
      setNote("");
      setLinks("");
      setFiles([]);
      setAfterShots([]);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy("");
  }

  // On-site work: upload the before photos ("Start job").
  async function handleStart() {
    const form = new FormData();
    appendShots(form, beforeShots);
    setBusy("starting");
    setError("");
    try {
      await postForm(`${apiBase}/start`, form);
      setBeforeShots([]);
      setRetaking(false);
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

  // The artisan types in the code the person at the place gave them.
  async function handleConfirmCode() {
    setBusy("confirming");
    setError("");
    try {
      await postJson(`${apiBase}/confirm-code`, { code });
      setCode("");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      router.refresh(); // shows the lock if that was the last try
    }
    setBusy("");
  }

  const nothingToSend = files.length === 0 && links.trim() === "";
  const codeOpen = usesCode && (status === "funds_held" || status === "work_submitted");
  const codeLocked = (milestone.codeTries ?? 0) >= 5;
  const isMaterials = milestone.kind === "materials";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium">{milestone.title}</p>
          <p className="text-sm text-slate-500">Due {formatDate(milestone.dueDate)}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <p className="font-semibold tabular-nums">{formatMoney(milestone.amount)}</p>
          <Naira usd={milestone.amount} />
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
              <span className="font-semibold">{clientName} asked for fixes:</span>
              <p className="mt-1 whitespace-pre-wrap">{milestone.clientFeedback}</p>
              {milestone.fixDeadline && (
                <p className="mt-2 text-xs">
                  Send the fix by{" "}
                  <span suppressHydrationWarning className="font-medium">
                    {formatDateTime(milestone.fixDeadline)}
                  </span>
                  . After that, {clientName} can cancel and get their money back.
                </p>
              )}
            </div>
          )}
          {aiCheck && (
            <>
              {usesPhotos ? (
                <BeforeAfter
                  dealId={dealId}
                  before={beforePhotos}
                  after={deliverables}
                  startedAt={milestone.startedAt}
                  submittedAt={milestone.submittedAt}
                />
              ) : (
                <DeliverableList dealId={dealId} items={deliverables} />
              )}
              <AiCheckBox check={aiCheck} />
            </>
          )}

          {usesPhotos && (beforePhotos.length === 0 || retaking) ? (
            // On-site, step 1: photograph the place before starting.
            <>
              <p className="mt-3 text-sm text-slate-600">
                The client&apos;s money is held. <span className="font-medium">Before you start</span>, photograph the
                place as it is now (e.g. the messy room). The AI compares these with your photos when you finish.
              </p>
              <PhotoCapture label="Take before photos" shots={beforeShots} onChange={setBeforeShots} />
              <div className="mt-3 flex gap-2">
                <button
                  onClick={handleStart}
                  disabled={busy !== "" || beforeShots.length === 0}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {busy === "starting" ? "Uploading photos…" : retaking ? "Save new before photos" : "Start job"}
                </button>
                {retaking && (
                  <button onClick={() => setRetaking(false)} className="px-3 py-2 text-sm text-slate-600">
                    Cancel
                  </button>
                )}
              </div>
            </>
          ) : usesPhotos ? (
            // On-site, step 2: photograph the finished job.
            <>
              {!aiCheck && (
                <BeforeAfter dealId={dealId} before={beforePhotos} startedAt={milestone.startedAt} />
              )}
              {!milestone.submittedAt && (
                <button onClick={() => setRetaking(true)} className="mt-1 text-xs text-slate-500 underline">
                  Retake before photos
                </button>
              )}
              <p className="mt-3 text-sm text-slate-600">
                When the job is done, photograph <span className="font-medium">the same spots from the same angles</span>.
                The AI checks the change against what you agreed.
              </p>
              <PhotoCapture label="Take after photos" shots={afterShots} onChange={setAfterShots} />
              <label className="mt-3 block text-sm font-medium">
                Note to the client <span className="font-normal text-slate-500">(optional)</span>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="What you did, parts used, anything to watch"
                  className={inputClass}
                />
              </label>
              <button
                onClick={handleSubmit}
                disabled={busy !== "" || afterShots.length === 0}
                className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {busy === "checking" ? "AI is comparing the photos…" : "Finish job & submit for AI check"}
              </button>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      )}

      {status === "work_submitted" && (
        <div className="mt-3">
          {usesPhotos ? (
            <BeforeAfter
              dealId={dealId}
              before={beforePhotos}
              after={deliverables}
              startedAt={milestone.startedAt}
              submittedAt={milestone.submittedAt}
            />
          ) : (
            <DeliverableList dealId={dealId} items={deliverables} />
          )}
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

      {/* On-site jobs: confirmation from the person at the place */}
      {usesCode && milestone.confirmedOnsiteAt && (
        <p className="mt-3 rounded-lg bg-teal-50 p-3 text-sm text-teal-900">
          ⌂ {isMaterials ? "Materials confirmed at the place" : "Confirmed on-site"}{" "}
          <span suppressHydrationWarning>{formatDateTime(milestone.confirmedOnsiteAt)}</span> — the completion code was
          entered.
        </p>
      )}
      {codeOpen && !milestone.confirmedOnsiteAt && (
        <div className="mt-3 rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900">
          <p className="font-semibold">Completion code</p>
          {codeLocked ? (
            <p className="mt-1">Too many wrong codes, so it&apos;s locked. {clientName} can still approve the job.</p>
          ) : (
            <>
              <p className="mt-1">
                {isMaterials ? "When the materials are at the place" : "When the job is done"}, ask the person there
                for the 6-digit code {clientName} sent them, and enter it here.
              </p>
              <div className="mt-2 flex gap-2">
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="w-32 rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono tracking-widest focus:border-brand-500 focus:outline-none"
                />
                <button
                  onClick={handleConfirmCode}
                  disabled={busy !== "" || code.length !== 6}
                  className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
                >
                  {busy === "confirming" ? "Checking…" : isMaterials ? "Confirm materials arrived" : "Confirm on-site"}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Where the money went: forwarded to the freelancer's own PayPal */}
      {status === "released" && <PayoutStatus dealId={dealId} milestone={milestone} hasPayoutEmail={hasPayoutEmail} />}

      {/* The freelancer can always back out before payout */}
      {(status === "funds_held" || status === "work_submitted") && (
        <CancelButton dealId={dealId} milestoneId={milestone.id} amount={milestone.amount} who="freelancer" />
      )}

      {status === "refunded" && (
        <p className="mt-3 text-sm text-slate-600">
          Cancelled {milestone.refundedBy === "freelancer" ? "by you" : `by ${clientName} after a missed deadline`} — the
          client&apos;s money was released back to them.
        </p>
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
