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
import { cancelDeadline, clientCancelBlocker, hasSubmission } from "@/lib/release";
import CancelButton from "@/components/CancelButton";
import type { Milestone } from "@/lib/types";

// The freelancer's note, files and the AI report for one milestone.
function Delivery({ dealId, m }: { dealId: string; m: Milestone }) {
  return (
    <>
      {m.deliveryNote && (
        <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm">
          <span className="font-medium">Freelancer&apos;s note:</span> {m.deliveryNote}
        </p>
      )}
      <DeliverableList dealId={dealId} items={m.deliverables ?? []} />
      {m.aiCheck && <AiCheckBox check={m.aiCheck} />}
    </>
  );
}

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

                {/* A. Delivered, waiting for the client's decision */}
                {m.status === "work_submitted" && (
                  <>
                    <p className="mt-3 text-sm text-slate-600">
                      The freelancer delivered this milestone. Open the files below and read the AI&apos;s report.
                    </p>
                    <Delivery dealId={deal.id} m={m} />
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

                {/* B. Work was handed in but needs fixing (AI concerns, or the client asked) */}
                {m.status === "funds_held" && hasSubmission(m) && (
                  <>
                    {m.clientFeedback ? (
                      <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                        <p className="font-semibold">You asked for fixes:</p>
                        <p className="mt-1 whitespace-pre-wrap">{m.clientFeedback}</p>
                        {m.fixDeadline && (
                          <p className="mt-2 text-xs">
                            The freelancer has until{" "}
                            <span suppressHydrationWarning className="font-medium">
                              {formatDateTime(m.fixDeadline)}
                            </span>{" "}
                            to send a fix. If they don&apos;t, you can cancel and get your money back.
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                        <p className="font-semibold">The AI found problems with this delivery</p>
                        <p className="mt-1">
                          The freelancer has been asked to fix them. You can look at the work now, add your own
                          comments, or approve it anyway if you&apos;re happy with it.
                        </p>
                      </div>
                    )}
                    <Delivery dealId={deal.id} m={m} />
                    <ReviewActions dealId={deal.id} milestoneId={m.id} amount={m.amount} linkKey={linkKey} flagged />
                  </>
                )}

                {/* C. Paid and held, nothing delivered yet */}
                {m.status === "funds_held" && !hasSubmission(m) && (
                  <p className="mt-3 text-sm text-slate-600">
                    Your payment is held. The work is due{" "}
                    <span suppressHydrationWarning>{formatDateTime(cancelDeadline(m))}</span>, and you&apos;ll review
                    it here.
                  </p>
                )}

                {/* Missed deadline: the client may take their money back */}
                {clientCancelBlocker(m) === null && (
                  <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    <p className="font-semibold">
                      {m.clientFeedback ? "No fix arrived in time." : "The due date has passed without a delivery."}
                    </p>
                    <p className="mt-1">You can cancel this milestone. PayPal releases the hold, so you&apos;re not charged.</p>
                    <CancelButton dealId={deal.id} milestoneId={m.id} amount={m.amount} who="client" linkKey={linkKey} />
                  </div>
                )}

                {/* D. Paid out — the client keeps access to what they paid for */}
                {m.status === "released" && (
                  <>
                    <p className="mt-3 text-sm text-brand-700">Approved and paid ✓ Your files stay available here.</p>
                    <DeliverableList dealId={deal.id} items={m.deliverables ?? []} />
                  </>
                )}

                {/* E. Cancelled */}
                {m.status === "refunded" && (
                  <p className="mt-3 text-sm text-slate-600">
                    Cancelled{m.refundedBy === "freelancer" ? " by the freelancer" : ""} — PayPal released the hold, so
                    you weren&apos;t charged for this milestone.
                  </p>
                )}
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
