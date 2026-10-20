// ON-SITE PROOF — the "before" and "after" photos side by side, with the
// time each was taken. A photo much older than its upload gets a warning
// (it was probably picked from the gallery, not taken on the spot).
// Used on the artisan's deal page and the payer's review page.
import { formatDateTime, staleNote } from "@/lib/format";
import type { Deliverable } from "@/lib/types";

type Props = {
  dealId: string;
  before: Deliverable[];
  after?: Deliverable[];
  startedAt?: string; // when the before photos were uploaded
  submittedAt?: string; // when the after photos were uploaded
};

function Photos({ dealId, title, photos, uploadedAt }: { dealId: string; title: string; photos: Deliverable[]; uploadedAt?: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {photos.map((p) => {
          const stale = staleNote(p.takenAt, uploadedAt);
          return (
            <a key={p.id} href={`/api/deals/${dealId}/files/${p.id}`} target="_blank" rel="noopener noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element -- served by our own file route */}
              <img
                src={`/api/deals/${dealId}/files/${p.id}`}
                alt={`${title} photo`}
                className="aspect-square w-full rounded-lg object-cover ring-1 ring-slate-200"
              />
              <p className="mt-0.5 text-[11px] text-slate-500" suppressHydrationWarning>
                {p.takenAt ? `📷 ${formatDateTime(p.takenAt)}` : "📷 time unknown"}
              </p>
              {stale && <p className="text-[11px] text-amber-700">⚠ {stale}</p>}
            </a>
          );
        })}
      </div>
    </div>
  );
}

export default function BeforeAfter({ dealId, before, after = [], startedAt, submittedAt }: Props) {
  if (before.length === 0 && after.length === 0) return null;
  return (
    <div className="mt-3 grid gap-4 rounded-lg border border-slate-200 p-3 sm:grid-cols-2">
      <Photos dealId={dealId} title="Before" photos={before} uploadedAt={startedAt} />
      {after.length > 0 ? (
        <Photos dealId={dealId} title="After" photos={after} uploadedAt={submittedAt} />
      ) : (
        <div className="flex items-center justify-center rounded-lg bg-slate-50 p-4 text-center text-xs text-slate-500">
          After photos come when the job is finished
        </div>
      )}
    </div>
  );
}
