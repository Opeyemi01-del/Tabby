"use client";
// NEW DEAL ("/deals/new") — paste a client chat, AI drafts the deal, you review it.
// "use client" (line 1) means this page runs in the browser, because it
// reacts to typing and button clicks. `useState` holds values that change.
import { useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import type { DraftDeal } from "@/lib/ai";
import { postJson } from "@/lib/client-api";
import { formatMoney } from "@/lib/format";

// Shared look for every text box on this page.
const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none";

export default function NewDealPage() {
  const router = useRouter();
  const [chat, setChat] = useState("");
  const [draft, setDraft] = useState<DraftDeal | null>(null);
  const [loading, setLoading] = useState(false); // AI is drafting
  const [saving, setSaving] = useState(false); // deal is being saved
  const [error, setError] = useState("");

  // Sends the chat to the AI and shows its draft.
  async function handleExtract() {
    setLoading(true);
    setError("");
    try {
      setDraft(await postJson<DraftDeal>("/api/ai/extract-deal", { chat }));
    } catch (err) {
      setError((err as Error).message);
    }
    setLoading(false);
  }

  // Saves the reviewed deal, then opens it.
  async function handleCreate() {
    if (!draft) return;
    setSaving(true);
    setError("");
    try {
      const { id } = await postJson<{ id: string }>("/api/deals", { ...draft, agreement: chat });
      router.push(`/deals/${id}`);
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  // Updates one field of one milestone when you edit it.
  function updateMilestone(index: number, field: "title" | "amount" | "dueInDays", value: string) {
    if (!draft) return;
    const milestones = draft.milestones.map((m, i) =>
      i === index ? { ...m, [field]: field === "title" ? value : Number(value) } : m,
    );
    setDraft({ ...draft, milestones });
  }

  const total = draft ? draft.milestones.reduce((sum, m) => sum + m.amount, 0) : 0;

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-semibold">New deal</h1>
        <p className="mt-1 text-slate-600">Paste your conversation with the client. AI will draft the deal for you.</p>

        {/* Step 1: paste the chat */}
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
          <label htmlFor="chat" className="text-sm font-medium">
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
          <button
            onClick={handleExtract}
            disabled={loading || chat.trim() === ""}
            className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? "AI is reading the chat…" : draft ? "Draft again" : "Draft deal with AI"}
          </button>
        </section>

        {/* Error message (from the AI or from saving) */}
        {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        {/* Step 2: review what the AI drafted */}
        {draft && (
          <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold">Review the deal</h2>
            <p className="text-sm text-slate-500">Check everything — you can edit any field.</p>

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

            <h3 className="mt-5 text-sm font-medium">Milestones</h3>
            <div className="mt-1 grid grid-cols-[1fr_7rem_6rem] gap-2 text-xs text-slate-500">
              <span>What&apos;s delivered</span>
              <span>Amount ($)</span>
              <span>Due in (days)</span>
            </div>
            <div className="mt-1 flex flex-col gap-2">
              {draft.milestones.map((m, i) => (
                <div key={i} className="grid grid-cols-[1fr_7rem_6rem] gap-2">
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

            <div className="mt-5 flex items-center justify-between">
              <p className="text-sm">
                Total: <span className="font-semibold">{formatMoney(total)}</span>
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
