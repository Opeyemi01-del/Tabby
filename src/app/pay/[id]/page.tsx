// CLIENT PAYMENT PAGE ("/pay/d-1003") — the link the freelancer sends.
// This page is for the CLIENT, so it has no freelancer menu.
// In step 2 the placeholder button becomes the real PayPal checkout.
import { notFound } from "next/navigation";
import { getDeal } from "@/lib/deals";
import { formatDate, formatMoney } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";

export default async function PayPage({ params }: PageProps<"/pay/[id]">) {
  const { id } = await params;
  const deal = getDeal(id);
  if (!deal) notFound();

  // The client pays the first milestone that hasn't been paid yet.
  const dueNow = deal.milestones.find((m) => m.status === "awaiting_payment");

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-12">
      <p className="text-center text-xl font-bold text-brand-700">Tabby</p>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-500">Payment request for {deal.clientName}</p>
        <h1 className="mt-1 text-2xl font-semibold">{deal.title}</h1>

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
              <span className="text-2xl font-semibold tabular-nums">{formatMoney(dueNow.amount)}</span>
            </div>

            {/* Placeholder: replaced by the real PayPal button in step 2 */}
            <button
              disabled
              className="mt-5 w-full rounded-full bg-amber-400 py-3 font-semibold text-slate-900 opacity-80"
            >
              Pay with PayPal (coming in step 2)
            </button>
          </>
        ) : (
          <p className="mt-4 border-t border-slate-200 pt-4 text-center text-slate-600">Nothing to pay right now.</p>
        )}
      </div>

      {/* Reassurance for the client */}
      <div className="mt-4 rounded-xl bg-brand-50 p-4 text-sm text-brand-900">
        <p className="font-semibold">Your money is protected</p>
        <p className="mt-1">
          PayPal holds your payment. It&apos;s only released to the freelancer once the work is delivered and checked
          against what you agreed.
        </p>
      </div>
    </main>
  );
}
