"use client";
// NEW DEAL ("/deals/new") — paste a client chat, AI drafts the deal, you review it.
// "use client" (line 1) means this page runs in the browser, because it
// reacts to typing and button clicks. `useState` holds values that change.
import { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { extractDealFromChat, type ExtractedDeal } from "@/lib/mock-ai";
import { formatMoney } from "@/lib/format";

// Shared look for every text box on this page.
const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none";

export default function NewDealPage() {
  const [chat, setChat] = useState("");
  const [draft, setDraft] = useState<ExtractedDeal | null>(null);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(false);

  async function handleExtract() {
    setLoading(true);
    setDraft(await extractDealFromChat(chat));
    setLoading(false);
  }

  // Updates one field of one milestone when you edit it.
  function updateMilestone(index: number, field: "title" | "amount", value: string) {
    if (!draft) return;
    const milestones = draft.milestones.map((m, i) =>
      i === index ? { ...m, [field]: field === "amount" ? Number(value) : value } : m,
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
            {loading ? "AI is reading the chat…" : "Draft deal with AI"}
          </button>
        </section>

        {/* Step 2: review what the AI drafted */}
        {draft && !created && (
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
            <div className="mt-2 flex flex-col gap-2">
              {draft.milestones.map((m, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className={inputClass}
                    value={m.title}
                    onChange={(e) => updateMilestone(i, "title", e.target.value)}
                  />
                  <input
                    className={`${inputClass} w-32`}
                    type="number"
                    min={1}
                    value={m.amount}
                    onChange={(e) => updateMilestone(i, "amount", e.target.value)}
                  />
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between">
              <p className="text-sm">
                Total: <span className="font-semibold">{formatMoney(total)}</span>
              </p>
              <button
                onClick={() => setCreated(true)}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                Create deal & payment link
              </button>
            </div>
          </section>
        )}

        {/* Step 3: done */}
        {created && (
          <section className="mt-6 rounded-xl border border-brand-100 bg-brand-50 p-5">
            <h2 className="font-semibold text-brand-900">Deal created (demo)</h2>
            <p className="mt-1 text-sm text-brand-900">
              Once PayPal is connected, this will save the deal and give you a payment link to send your client.
            </p>
            <div className="mt-3 flex gap-3 text-sm font-medium">
              <Link href="/pay/d-1003" className="text-brand-700 underline">
                See what your client sees
              </Link>
              <Link href="/dashboard" className="text-brand-700 underline">
                Back to dashboard
              </Link>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
