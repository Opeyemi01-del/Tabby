"use client";
// NEW DEAL ("/deals/new") — give the AI the client chat (pasted text OR
// screenshots, e.g. from WhatsApp), it drafts the deal, you review it.
// "use client" (line 1) means this page runs in the browser, because it
// reacts to typing and button clicks. `useState` holds values that change.
import { useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Naira from "@/components/Naira";
import type { DraftDeal } from "@/lib/ai";
import { postForm, postJson } from "@/lib/client-api";
import { formatMoney } from "@/lib/format";

// Shared look for every text box on this page.
const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none";

const MAX_SCREENSHOTS = 3;
const PAYOUT_EMAIL_KEY = "tabby-payout-email";

// LOOK OF THE "COULDN'T READ" WARNINGS — edit these to restyle them.
const warningStyles = {
  // Border around a screenshot preview the AI couldn't read
  badPreview: "ring-4 ring-amber-500",
  // Small label on that preview
  badLabel: "absolute inset-x-0 bottom-0 rounded-b-lg bg-amber-600/90 px-1 py-0.5 text-center text-[10px] font-semibold text-white",
  // The warning box shown above the deal review
  box: "mt-4 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800",
  icon: "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-600 text-xs font-bold text-white",
};

// A chosen screenshot + a temporary URL to preview it.
type Shot = { file: File; url: string };

export default function NewDealPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"text" | "screenshots">("text");
  const [chat, setChat] = useState("");
  const [shots, setShots] = useState<Shot[]>([]);
  const [draft, setDraft] = useState<DraftDeal | null>(null);
  // Preview URLs of screenshots the AI couldn't read (removing one clears it).
  const [unreadableUrls, setUnreadableUrls] = useState<string[]>([]);
  // The freelancer's PayPal email (where payouts go), remembered between
  // deals. Filled in from this browser's memory when the draft appears.
  const [payoutEmail, setPayoutEmail] = useState("");
  function recallPayoutEmail() {
    if (payoutEmail) return;
    try {
      setPayoutEmail(localStorage.getItem(PAYOUT_EMAIL_KEY) ?? "");
    } catch {
      // storage blocked — the field just starts empty
    }
  }
  const [loading, setLoading] = useState(false); // AI is drafting
  const [saving, setSaving] = useState(false); // deal is being saved
  const [error, setError] = useState("");

  // Adds picked screenshots (keeping at most 3).
  function addShots(list: FileList | null) {
    const room = MAX_SCREENSHOTS - shots.length;
    const added = Array.from(list ?? [])
      .slice(0, room)
      .map((file) => ({ file, url: URL.createObjectURL(file) }));
    setShots([...shots, ...added]);
  }

  function removeShot(index: number) {
    URL.revokeObjectURL(shots[index].url); // free the preview's memory
    setShots(shots.filter((_, i) => i !== index));
  }

  // Sends the chat (text or screenshots) to the AI and shows its draft.
  async function handleExtract() {
    recallPayoutEmail();
    setLoading(true);
    setError("");
    try {
      if (mode === "text") {
        setDraft(await postJson<DraftDeal>("/api/ai/extract-deal", { chat }));
      } else {
        const form = new FormData();
        shots.forEach((s) => form.append("screenshots", s.file));
        const result = await postForm<DraftDeal>("/api/ai/extract-deal", form);
        setDraft(result);
        // The AI numbers screenshots from 1; remember which previews those were.
        setUnreadableUrls((result.unreadable ?? []).map((n) => shots[n - 1]?.url).filter(Boolean));
      }
    } catch (err) {
      setError((err as Error).message);
    }
    setLoading(false);
  }

  // Saves the reviewed deal, then opens it.
  // The agreement is the pasted chat, or the (checked) screenshot transcript.
  async function handleCreate() {
    if (!draft) return;
    setSaving(true);
    setError("");
    try {
      const agreement = mode === "text" ? chat : (draft.transcript ?? "");
      const deal = { ...draft, agreement, payoutEmail };
      try {
        localStorage.setItem(PAYOUT_EMAIL_KEY, payoutEmail); // remember for next time (this browser only)
      } catch {
        // storage blocked (e.g. private window) — not a problem
      }
      let id: string;
      if (mode === "text") {
        ({ id } = await postJson<{ id: string }>("/api/deals", deal));
      } else {
        // Also send the original screenshots: kept privately as dispute evidence.
        const form = new FormData();
        form.append("deal", JSON.stringify(deal));
        shots.forEach((s) => form.append("screenshots", s.file));
        ({ id } = await postForm<{ id: string }>("/api/deals", form));
      }
      router.push(`/deals/${id}`);
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  // Updates one field of one milestone when you edit it.
  function updateMilestone(index: number, field: "title" | "amount" | "dueInDays" | "kind", value: string) {
    if (!draft) return;
    const isText = field === "title" || field === "kind";
    const milestones = draft.milestones.map((m, i) => (i === index ? { ...m, [field]: isText ? value : Number(value) } : m));
    setDraft({ ...draft, milestones });
  }

  const total = draft ? draft.milestones.reduce((sum, m) => sum + m.amount, 0) : 0;
  // Column layout of the milestone rows (an extra "Type" column for on-site jobs).
  const milestoneGrid =
    draft?.jobType === "onsite" ? "grid-cols-[7rem_1fr_6rem_5rem]" : "grid-cols-[1fr_7rem_6rem]";

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-semibold">New deal</h1>
        <p className="mt-1 text-slate-600">
          Paste your conversation with the client, or upload screenshots of it. AI will draft the deal for you.
        </p>

        {/* Step 1: give the AI the chat */}
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
          {/* Switch: Paste text | Upload screenshots */}
          <div className="mb-4 inline-flex rounded-lg bg-slate-100 p-1 text-sm font-medium">
            {(["text", "screenshots"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-md px-3 py-1.5 ${mode === m ? "bg-white shadow-sm" : "text-slate-600"}`}
              >
                {m === "text" ? "Paste text" : "Upload screenshots"}
              </button>
            ))}
          </div>

          {mode === "text" ? (
            <>
              <label htmlFor="chat" className="block text-sm font-medium">
                Client conversation
              </label>
              <textarea
                id="chat"
                rows={7}
                value={chat}
                onChange={(e) => setChat(e.target.value)}
                placeholder={"Client: Can you design my logo? Budget is $450.\nYou: Sure, 50% upfront and 50% on delivery."}
                className={`${inputClass} mt-2 font-mono`}
              />
            </>
          ) : (
            <>
              <p className="text-sm font-medium">Chat screenshots</p>
              <p className="text-sm text-slate-500">
                WhatsApp, Instagram, email — up to {MAX_SCREENSHOTS} images, in order. PNG, JPG or WebP.
              </p>

              {/* Previews */}
              <div className="mt-3 flex flex-wrap gap-3">
                {shots.map((s, i) => (
                  <div key={s.url} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element -- local preview, not a hosted image */}
                    <img
                      src={s.url}
                      alt={`Screenshot ${i + 1}`}
                      className={`h-40 w-24 rounded-lg border object-cover object-top ${
                        unreadableUrls.includes(s.url) ? warningStyles.badPreview : ""
                      }`}
                    />
                    <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 text-xs text-white">{i + 1}</span>
                    {unreadableUrls.includes(s.url) && <span className={warningStyles.badLabel}>AI couldn&apos;t read this</span>}
                    <button
                      onClick={() => removeShot(i)}
                      aria-label={`Remove screenshot ${i + 1}`}
                      className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-white text-sm shadow ring-1 ring-slate-300"
                    >
                      ×
                    </button>
                  </div>
                ))}

                {shots.length < MAX_SCREENSHOTS && (
                  <label className="flex h-40 w-24 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-center text-xs text-slate-500 hover:border-brand-500">
                    <span className="text-2xl">+</span>
                    Add
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        addShots(e.target.files);
                        e.target.value = ""; // allow picking the same file again
                      }}
                    />
                  </label>
                )}
              </div>
            </>
          )}

          <button
            onClick={handleExtract}
            disabled={loading || (mode === "text" ? chat.trim() === "" : shots.length === 0)}
            className="mt-4 block rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {loading
              ? mode === "text"
                ? "AI is reading the chat…"
                : "AI is reading your screenshots…"
              : draft
                ? "Draft again"
                : "Draft deal with AI"}
          </button>
        </section>

        {/* Error message (from the AI or from saving) */}
        {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        {/* Step 2: review what the AI drafted */}
        {draft && (
          <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold">Review the deal</h2>
            <p className="text-sm text-slate-500">Check everything — you can edit any field.</p>

            {/* Warning: some screenshots couldn't be read */}
            {mode === "screenshots" && unreadableUrls.length > 0 && (
              <div role="alert" className={warningStyles.box}>
                <span className={warningStyles.icon}>!</span>
                <div>
                  <p className="font-semibold">
                    Screenshot{unreadableUrls.length > 1 ? "s" : ""}{" "}
                    {unreadableUrls.map((url) => shots.findIndex((s) => s.url === url) + 1).join(" and ")}{" "}
                    couldn&apos;t be read
                  </p>
                  <p className="mt-0.5">
                    The deal below may be missing details from {unreadableUrls.length > 1 ? "them" : "it"}. Replace it
                    with a clearer, shorter screenshot and click &ldquo;Draft again&rdquo;, or check the transcript
                    carefully.
                  </p>
                </div>
              </div>
            )}

            {/* What the AI read from the screenshots — this becomes the agreement */}
            {mode === "screenshots" && draft.transcript !== undefined && (
              <div className="mt-4">
                <label htmlFor="transcript" className="text-sm font-medium">
                  AI read this from your screenshots
                </label>
                <p className="text-xs text-slate-500">
                  Fix anything it misread — this becomes the agreement the AI checks deliveries against.
                </p>
                <textarea
                  id="transcript"
                  rows={6}
                  value={draft.transcript}
                  onChange={(e) => setDraft({ ...draft, transcript: e.target.value })}
                  className={`${inputClass} mt-2 font-mono`}
                />
              </div>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <input
                className={inputClass}
                placeholder="Project title"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
              <input
                className={inputClass}
                placeholder="Client name"
                value={draft.clientName}
                onChange={(e) => setDraft({ ...draft, clientName: e.target.value })}
              />
              <input
                className={inputClass}
                placeholder="Client email"
                type="email"
                value={draft.clientEmail}
                onChange={(e) => setDraft({ ...draft, clientEmail: e.target.value })}
              />
            </div>

            {/* Job type: digital work vs on-site job (plumbing, repairs...) */}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium">Job type</span>
              <div className="inline-flex rounded-lg bg-slate-100 p-1 text-sm font-medium">
                {(["digital", "onsite"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        jobType: t,
                        // Materials milestones only exist for on-site jobs.
                        milestones: t === "digital" ? draft.milestones.map((m) => ({ ...m, kind: "work" })) : draft.milestones,
                      })
                    }
                    className={`rounded-md px-3 py-1.5 ${draft.jobType === t ? "bg-white shadow-sm" : "text-slate-600"}`}
                  >
                    {t === "digital" ? "💻 Digital work" : "🔧 On-site job"}
                  </button>
                ))}
              </div>
              {draft.jobType === "onsite" && (
                <input
                  className={`${inputClass} sm:w-60`}
                  placeholder="Area, e.g. Surulere, Lagos"
                  value={draft.jobLocation}
                  onChange={(e) => setDraft({ ...draft, jobLocation: e.target.value })}
                />
              )}
            </div>
            {draft.jobType === "onsite" && (
              <p className="mt-1 text-xs text-slate-500">
                On-site jobs are proven with before/after photos, and the client confirms with a completion code. Only
                the area is shown — never the full address.
              </p>
            )}

            <h3 className="mt-5 text-sm font-medium">Milestones</h3>
            <div className={`mt-1 grid ${milestoneGrid} gap-2 text-xs text-slate-500`}>
              {draft.jobType === "onsite" && <span>Type</span>}
              <span>What&apos;s delivered</span>
              <span>Amount ($)</span>
              <span>Due in (days)</span>
            </div>
            <div className="mt-1 flex flex-col gap-2">
              {draft.milestones.map((m, i) => (
                <div key={i} className={`grid ${milestoneGrid} gap-2`}>
                  {draft.jobType === "onsite" && (
                    <select
                      className={inputClass}
                      value={m.kind}
                      onChange={(e) => updateMilestone(i, "kind", e.target.value)}
                    >
                      <option value="materials">Materials</option>
                      <option value="work">Work</option>
                    </select>
                  )}
                  <input
                    className={inputClass}
                    value={m.title}
                    onChange={(e) => updateMilestone(i, "title", e.target.value)}
                  />
                  <input
                    className={inputClass}
                    type="number"
                    min={1}
                    value={m.amount}
                    onChange={(e) => updateMilestone(i, "amount", e.target.value)}
                  />
                  <input
                    className={inputClass}
                    type="number"
                    min={1}
                    max={29}
                    value={m.dueInDays}
                    onChange={(e) => updateMilestone(i, "dueInDays", e.target.value)}
                  />
                </div>
              ))}
            </div>

            {/* Where the freelancer gets paid */}
            <div className="mt-5">
              <label htmlFor="payoutEmail" className="text-sm font-medium">
                Your PayPal email <span className="font-normal text-slate-500">(where you get paid)</span>
              </label>
              <input
                id="payoutEmail"
                type="email"
                className={`${inputClass} mt-1 sm:w-80`}
                placeholder="you@example.com"
                value={payoutEmail}
                onChange={(e) => setPayoutEmail(e.target.value)}
              />
              <p className="mt-1 text-xs text-slate-500">
                When the client approves, Tabby sends the money here with PayPal Payouts. For safety it can&apos;t be
                changed after the deal is created.
              </p>
            </div>

            <div className="mt-5 flex items-center justify-between">
              <p className="text-sm">
                Total: <span className="font-semibold">{formatMoney(total)}</span> <Naira usd={total} />
              </p>
              <button
                onClick={handleCreate}
                disabled={saving}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Create deal & payment link"}
              </button>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
