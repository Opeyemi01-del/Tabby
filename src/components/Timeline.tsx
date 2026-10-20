// DISPUTE SHIELD TIMELINE — the deal's history, oldest first, with proof.
// Shows a "Record intact" badge when the fingerprint chain checks out.
// Used on the freelancer's deal page and the public certificate.
import { verifyChain } from "@/lib/events";
import { formatDateTime } from "@/lib/format";
import type { Deal, EventType } from "@/lib/types";

// LOOK OF THE TIMELINE — edit these to restyle it.
const timelineStyles = {
  list: "relative ml-3 border-l-2 border-slate-200",
  item: "relative pb-6 pl-6 last:pb-0",
  dot: "absolute -left-[11px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white ring-4 ring-white",
  time: "text-xs text-slate-500",
  summary: "text-sm font-medium",
  proof: "mt-1 font-mono text-[11px] text-slate-500 break-all",
  intact: "inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 ring-1 ring-brand-100",
  broken: "inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-200",
};

// An icon and color for each kind of step.
const kinds: Record<EventType, { icon: string; color: string }> = {
  deal_created: { icon: "✎", color: "bg-slate-500" },
  payment_held: { icon: "$", color: "bg-sky-600" },
  work_started: { icon: "▶", color: "bg-teal-600" },
  work_submitted: { icon: "↑", color: "bg-violet-600" },
  ai_checked: { icon: "AI", color: "bg-indigo-600" },
  onsite_confirmed: { icon: "⌂", color: "bg-teal-600" },
  changes_requested: { icon: "↺", color: "bg-amber-500" },
  released: { icon: "✓", color: "bg-brand-600" },
  refunded: { icon: "↩", color: "bg-slate-500" },
  payout_sent: { icon: "→", color: "bg-emerald-600" },
  dispute_opened: { icon: "!", color: "bg-red-600" },
  evidence_submitted: { icon: "⚖", color: "bg-slate-700" },
};

type Props = {
  deal: Deal;
  milestoneId?: string; // show only one milestone's steps (+ the agreement)
  hideProof?: boolean;
};

export default function Timeline({ deal, milestoneId, hideProof }: Props) {
  const all = deal.events ?? [];
  if (all.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        This deal was created before Dispute Shield, so it has no recorded history.
      </p>
    );
  }

  const intact = verifyChain(all); // always checks the WHOLE chain
  const events = milestoneId ? all.filter((e) => !e.milestoneId || e.milestoneId === milestoneId) : all;
  const titleOf = (id?: string) => deal.milestones.find((m) => m.id === id)?.title;

  return (
    <div>
      <p className="mb-4">
        {intact ? (
          <span className={timelineStyles.intact}>🛡 Record intact — {all.length} steps, fingerprint-chained</span>
        ) : (
          <span className={timelineStyles.broken}>⚠ Record has been altered — the fingerprint chain doesn&apos;t match</span>
        )}
      </p>

      <ol className={timelineStyles.list}>
        {events.map((e) => (
          <li key={e.hash} className={timelineStyles.item}>
            <span className={`${timelineStyles.dot} ${kinds[e.type].color}`}>{kinds[e.type].icon}</span>
            <p className={timelineStyles.time}>
              <span suppressHydrationWarning>{formatDateTime(e.at)}</span>
              {!milestoneId && e.milestoneId && <> · {titleOf(e.milestoneId)}</>}
            </p>
            <p className={timelineStyles.summary}>{e.summary}</p>
            {!hideProof &&
              e.proof?.map((p) => (
                <p key={p} className={timelineStyles.proof}>
                  {p}
                </p>
              ))}
          </li>
        ))}
      </ol>
    </div>
  );
}
