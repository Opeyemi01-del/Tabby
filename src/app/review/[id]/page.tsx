// CLIENT REVIEW PAGE ("/review/d-1003") — where the client checks the
// delivered work and approves the payment (layer 1).
// Only the person who paid can use it: their browser got a secret key
// when they paid (cookie), or they open the private link (?key=...).
import { notFound } from "next/navigation";
import AiCheckBox from "@/components/AiCheckBox";
import DeliverableList from "@/components/DeliverableList";
import ReviewActions from "@/components/ReviewActions";
import StatusBadge from "@/components/StatusBadge";
import { getClientKey, isValidClientKey } from "@/lib/client-key";
import { getDeal } from "@/lib/deals";
import { formatDateTime, formatMoney } from "@/lib/format";

export default async function ReviewPage({ params, searchParams }: PageProps<"/review/[id]">) {
  const { id } = await params;
  const deal = getDeal(id);
  if (!deal) notFound();

  const { key: keyParam } = await searchParams;
  const linkKey = typeof keyParam === "string" ? keyParam : undefined;
  const allowed = isValidClientKey(deal, await getClientKey(deal.id, linkKey));

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12">
      <p className="text-center text-xl font-bold text-brand-700">Tabby</p>

      {!allowed ? (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <h1 className="text-xl font-semibold">This review page is private</h1>
          <p className="mt-2 text-slate-600">
            Only the person who paid for &ldquo;{deal.title}&rdquo; can review this work. If that&apos;s you, open the
            private review link you received after paying, or use the browser you paid with.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6">
            <p className="text-sm text-slate-500">Review for {deal.clientName}</p>
            <h1 className="text-2xl font-semibold">{deal.title}</h1>
          </div>

          <div className="mt-6 flex flex-col gap-4">
            {deal.milestones.map((m) => (
              <section key={m.id} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-start justify-between gap-4">
                  <p className="font-medium">{m.title}</p>
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-semibold tabular-nums">{formatMoney(m.amount)}</span>
                    <StatusBadge status={m.status} />
                  </div>
                </div>

                {m.status === "work_submitted" && (
                  <>
                    <p className="mt-3 text-sm text-slate-600">
                      The freelancer delivered this milestone. Check the files below and the AI&apos;s report.
                    </p>
                    {m.deliveryNote && (
                      <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm">
                        <span className="font-medium">Freelancer&apos;s note:</span> {m.deliveryNote}
                      </p>
                    )}
                    <DeliverableList dealId={deal.id} items={m.deliverables ?? []} />
                    {m.aiCheck && <AiCheckBox check={m.aiCheck} />}

                    {m.reviewDeadline && m.aiCheck?.verdict === "verified" && (
                      <p className="mt-3 text-xs text-slate-500">
                        If you don&apos;t respond by{" "}
                        <span suppressHydrationWarning>{formatDateTime(m.reviewDeadline)}</span>, the payment can be
                        released automatically because the AI verified the files.
                      </p>
                    )}

                    <ReviewActions dealId={deal.id} milestoneId={m.id} amount={m.amount} linkKey={linkKey} />
                  </>
                )}

                {m.status === "funds_held" && (
                  <p className="mt-3 text-sm text-slate-600">
                    {m.clientFeedback
                      ? "You asked for changes. Your payment stays held until you approve the new delivery."
                      : "Your payment is held. You'll review the work here once it's delivered."}
                  </p>
                )}
                {m.status === "released" && <p className="mt-3 text-sm text-brand-700">Approved and paid ✓</p>}
              </section>
            ))}
          </div>

          <p className="mt-6 text-center text-xs text-slate-500">
            Not happy with how this was resolved? You can still open a dispute with PayPal.
          </p>
        </>
      )}
    </main>
  );
}
