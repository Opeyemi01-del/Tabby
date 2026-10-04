// A small colored pill showing a status, e.g. "Funds held".
// Change a label or color here and it updates everywhere.
import type { Status } from "@/lib/types";

const styles: Record<Status, { label: string; className: string }> = {
  awaiting_payment: { label: "Awaiting payment", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  funds_held: { label: "Funds held", className: "bg-sky-50 text-sky-700 ring-sky-200" },
  work_submitted: { label: "Awaiting approval", className: "bg-violet-50 text-violet-700 ring-violet-200" },
  released: { label: "Paid", className: "bg-brand-50 text-brand-700 ring-brand-100" },
  refunded: { label: "Cancelled · refunded", className: "bg-slate-100 text-slate-600 ring-slate-200" },
  disputed: { label: "Disputed", className: "bg-red-50 text-red-700 ring-red-200" },
};

export default function StatusBadge({ status }: { status: Status }) {
  const { label, className } = styles[status];
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${className}`}>
      {label}
    </span>
  );
}
