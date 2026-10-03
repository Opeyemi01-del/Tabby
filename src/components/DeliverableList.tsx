// The files and links a freelancer handed in, with a download link for
// files and a note when the AI couldn't open something.
import type { Deliverable } from "@/lib/types";

function formatSize(bytes?: number) {
  if (!bytes) return "";
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

// Only real web links are clickable (blocks tricks like "javascript:...").
function safeHref(d: Deliverable, dealId: string): string | undefined {
  if (d.kind === "file") return `/api/deals/${dealId}/files/${d.id}`;
  return /^https?:\/\//i.test(d.name) ? d.name : undefined;
}

export default function DeliverableList({ dealId, items }: { dealId: string; items: Deliverable[] }) {
  if (items.length === 0) return null;

  return (
    <ul className="mt-3 flex flex-col gap-1 text-sm">
      {items.map((d) => (
        <li key={d.id} className="rounded-lg border border-slate-200 px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <a
              href={safeHref(d, dealId)}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate font-medium text-brand-700 underline"
            >
              {d.kind === "file" ? "📄 " : "🔗 "}
              {d.name}
            </a>
            <span className="shrink-0 text-xs text-slate-500">
              {formatSize(d.size)} {d.aiReadable ? "· AI inspected" : ""}
            </span>
          </div>
          {!d.aiReadable && d.aiNote && <p className="mt-1 text-xs text-amber-700">{d.aiNote}</p>}
        </li>
      ))}
    </ul>
  );
}
