// One row in the dashboard's deal list. Clicking it opens the deal.
import Link from "next/link";
import SampleBadge from "./SampleBadge";
import StatusBadge from "./StatusBadge";
import { dealStatus, dealTotal } from "@/lib/deals";
import { formatMoney } from "@/lib/format";
import type { Deal } from "@/lib/types";

export default function DealCard({ deal }: { deal: Deal }) {
  const paidCount = deal.milestones.filter((m) => m.status === "released").length;

  return (
    <Link
      href={`/deals/${deal.id}`}
      className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 hover:border-brand-500"
    >
      <div className="min-w-0">
        <p className="truncate font-medium">
          {deal.title} {deal.sample && <SampleBadge />}
        </p>
        <p className="text-sm text-slate-500">
          {deal.clientName} · {paidCount}/{deal.milestones.length} milestones paid
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <p className="font-semibold tabular-nums">{formatMoney(dealTotal(deal))}</p>
        <StatusBadge status={dealStatus(deal)} />
      </div>
    </Link>
  );
}
