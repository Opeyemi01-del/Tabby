// CLIENT PAYMENT PAGE ("/pay/d-1003") — the link the freelancer sends.
// This page is for the CLIENT, so it has no freelancer menu.
import { notFound } from "next/navigation";
import { getDeal } from "@/lib/deals";
import { formatDate, formatMoney } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";
import PayPalButton from "@/components/PayPalButton";
import Naira from "@/components/Naira";
import Link from "next/link";
import { getClientKey, isValidClientKey } from "@/lib/client-key";

export default async function PayPage({ params }: PageProps<"/pay/[id]">) {
  const { id } = await params;
  const deal = getDeal(id);
  if (!deal) notFound();

  // Public PayPal Client ID (from .env.local) for the checkout button.
  const paypalClientId = process.env.PAYPAL_CLIENT_ID;

  // The client pays the first milestone that hasn't been paid yet.
  const dueNow = deal.milestones.find((m) => m.status === "awaiting_payment");

  // Is this the browser that paid? Then offer the review page.
  const isPayer = isValidClientKey(deal, await getClientKey(deal.id));
  const workToReview = deal.milestones.some((m) => m.status === "work_submitted");

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-12">
      <p className="text-center text-xl font-bold text-brand-700">Tabby</p>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-500">Payment request for {deal.clientName}</p>
        <h1 className="mt-1 text-2xl font-semibold">{deal.title}</h1>
        {deal.jobType === "onsite" && (
          <p className="mt-1 text-sm text-slate-600">
            🔧 On-site job{deal.jobLocation ? ` · ${deal.jobLocation}` : ""} — proven with before/after photos, and
            confirmed on-site with a completion code
          </p>
        )}

        {/* All milestones, so the client sees the full plan */}
        <ul className="mt-5 divide-y divide-slate-100 text-sm">
          {deal.milestones.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="font-medium">{m.title}</p>
                <p className="text-slate-500">Due {formatDate(m.dueDate)}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="tabular-nums">{formatMoney(m.amount)}</span>
                <StatusBadge status={m.status} />
              </div>
            </li>
          ))}
        </ul>

        {dueNow ? (
          <>
            <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
              <span className="font-medium">Due now</span>
              <span className="flex flex-col items-end">
                <span className="text-2xl font-semibold tabular-nums">{formatMoney(dueNow.amount)}</span>
                <Naira usd={dueNow.amount} />
              </span>
            </div>

            {paypalClientId ? (
              <PayPalButton dealId={deal.id} clientId={paypalClientId} />
            ) : (
              <p className="mt-5 rounded-lg bg-amber-50 p-3 text-center text-sm text-amber-800">
                PayPal isn&apos;t connected yet. Add PAYPAL_CLIENT_ID to .env.local to enable payments.
              </p>
            )}
          </>
        ) : (
          <p className="mt-4 border-t border-slate-200 pt-4 text-center text-slate-600">Nothing to pay right now.</p>
        )}
      </div>

      {/* Shortcut to the review page, only for the browser that paid */}
      {isPayer && (
        <Link
          href={`/review/${deal.id}`}
          className="mt-4 block rounded-xl border border-brand-500 bg-white p-4 text-center font-medium text-brand-700 hover:bg-brand-50"
        >
          {workToReview ? "Work delivered — review it now →" : "Go to your review page →"}
        </Link>
      )}

      {/* Reassurance for the client */}
      <div className="mt-4 rounded-xl bg-brand-50 p-4 text-sm text-brand-900">
        <p className="font-semibold">Your money is protected</p>
        <p className="mt-1">
          PayPal holds your payment. When the work is delivered, AI checks the actual files against what you agreed,
          and the money is only released when you approve it.
        </p>
      </div>
    </main>
  );
}
