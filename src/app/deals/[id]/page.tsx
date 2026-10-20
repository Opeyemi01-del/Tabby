// DEAL DETAIL ("/deals/d-1001", "/deals/d-1002", ...)
// The [id] folder name means the last part of the URL is the deal's id.
import Link from "next/link";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import StatusBadge from "@/components/StatusBadge";
import MilestoneCard from "@/components/MilestoneCard";
import Timeline from "@/components/Timeline";
import Naira from "@/components/Naira";
import { dealIsActive, dealStatus, dealTotal, getDeal } from "@/lib/deals";
import AutoRefresh from "@/components/AutoRefresh";
import { formatDate, formatMoney } from "@/lib/format";
import { usesCompletionCode, usesPhotos, withoutCode } from "@/lib/onsite";
import { autoReleaseBlocker } from "@/lib/release";

export default async function DealPage({ params }: PageProps<"/deals/[id]">) {
  const { id } = await params;
  const deal = getDeal(id);
  if (!deal) notFound(); // shows the 404 page for unknown ids

  return (
    <>
      <Navbar />
      <AutoRefresh active={dealIsActive(deal)} />
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-900">
          ← Back to dashboard
        </Link>

        {/* Header */}
        <div className="mt-3 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{deal.title}</h1>
            <p className="text-slate-600">
              {deal.clientName} · {deal.clientEmail} · started {formatDate(deal.createdAt)}
            </p>
            {deal.jobType === "onsite" && (
              <p className="mt-1 text-sm text-slate-600">🔧 On-site job{deal.jobLocation ? ` · ${deal.jobLocation}` : ""}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <p className="text-xl font-semibold tabular-nums">{formatMoney(dealTotal(deal))}</p>
            <Naira usd={dealTotal(deal)} />
            <StatusBadge status={dealStatus(deal)} />
          </div>
        </div>

        {/* Payment link to send to the client */}
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <p className="font-medium">Client payment link</p>
          <p className="mt-1 text-slate-600">
            Send this to {deal.clientName}. Their payment is held by PayPal, and they approve the release once
            they&apos;ve reviewed your work.
          </p>
          <Link href={`/pay/${deal.id}`} className="mt-2 inline-block font-mono text-brand-700 underline">
            /pay/{deal.id}
          </Link>
          <p className="mt-3 border-t border-slate-100 pt-3 text-slate-600">
            {deal.payoutEmail
              ? `💸 When the client approves, your money is sent to your PayPal: ${deal.payoutEmail}`
              : "⚠ No payout email on this deal — approved money stays in Tabby's PayPal account."}
          </p>
        </div>

        {/* Milestones */}
        <h2 className="mb-3 mt-8 text-lg font-semibold">Milestones</h2>
        <div className="flex flex-col gap-3">
          {deal.milestones.map((m) => (
            <MilestoneCard
              key={m.id}
              dealId={deal.id}
              clientName={deal.clientName}
              milestone={withoutCode(m)}
              usesCode={usesCompletionCode(deal, m)}
              usesPhotos={usesPhotos(deal, m)}
              releaseReady={autoReleaseBlocker(m) === null}
              hasPayoutEmail={Boolean(deal.payoutEmail)}
            />
          ))}
        </div>

        {/* Dispute Shield: the deal's tamper-evident history */}
        <h2 className="mb-1 mt-8 text-lg font-semibold">Dispute Shield</h2>
        <p className="mb-4 text-sm text-slate-500">
          Every step is recorded with proof and chained by fingerprints, so the history can&apos;t be quietly changed.
        </p>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <Timeline deal={deal} />
        </div>

        {/* The agreement the AI checks work against */}
        <h2 className="mb-3 mt-8 text-lg font-semibold">Agreement</h2>
        <p className="mb-2 text-sm text-slate-500">
          The original chat. AI uses this to check deliveries and to build dispute evidence.
        </p>
        <pre className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-4 font-mono text-sm text-slate-700">
          {deal.agreement}
        </pre>
      </main>
    </>
  );
}
