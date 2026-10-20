// VERIFIED DELIVERY CERTIFICATE ("/certificate/d-123/m-1") — public, like a
// receipt. A freelancer can share it or put it in their portfolio.
// Shows: what was delivered, fingerprints, the AI check, who approved, and
// the deal's timeline. Hides: the files themselves, the client's email
// and full name, and full PayPal IDs.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Timeline from "@/components/Timeline";
import { getDeal } from "@/lib/deals";
import { short, verifyChain } from "@/lib/events";
import { formatDateTime, formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Verified Delivery Certificate · Tabby" };

// "Sarah Mensah" -> "S. M."
function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => `${w[0].toUpperCase()}.`)
    .join(" ");
}

// "4AB12345XY" -> "••••45XY"
function mask(id?: string) {
  return id ? `••••${id.slice(-4)}` : "—";
}

export default async function CertificatePage({ params }: PageProps<"/certificate/[id]/[milestoneId]">) {
  const { id, milestoneId } = await params;
  const deal = getDeal(id);
  const m = deal?.milestones.find((x) => x.id === milestoneId);
  if (!deal || !m) notFound();

  const events = deal.events ?? [];
  const released = events.findLast((e) => e.type === "released" && e.milestoneId === m.id);
  const delivered = events.findLast((e) => e.type === "work_submitted" && e.milestoneId === m.id);
  const intact = verifyChain(events);

  if (m.status !== "released" || !released) {
    return (
      <main className="mx-auto w-full max-w-lg px-4 py-16 text-center">
        <p className="text-xl font-bold text-brand-700">Tabby</p>
        <h1 className="mt-6 text-xl font-semibold">No certificate yet</h1>
        <p className="mt-2 text-slate-600">This milestone hasn&apos;t been delivered and approved yet.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12">
      <div className="rounded-2xl border-2 border-brand-500 bg-white p-6 sm:p-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-brand-700">Tabby</p>
            <h1 className="mt-1 text-2xl font-bold">Verified Delivery Certificate</h1>
          </div>
          <span className="text-4xl" aria-hidden>
            🛡
          </span>
        </div>

        <p className="mt-6 text-slate-600">This certifies that the following work was delivered, checked and paid:</p>
        <h2 className="mt-2 text-xl font-semibold">{m.title}</h2>
        <p className="text-slate-600">Part of &ldquo;{deal.title}&rdquo; for client {initials(deal.clientName)}</p>

        {/* Key facts */}
        <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-slate-500">Amount paid</dt>
            <dd className="font-semibold">{formatMoney(m.amount)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Approved by</dt>
            <dd className="font-semibold">
              {m.releasedBy === "client" ? "The client" : "Review period ended (AI-verified)"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Delivered</dt>
            <dd suppressHydrationWarning>{delivered ? formatDateTime(delivered.at) : "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Paid out</dt>
            <dd suppressHydrationWarning>{formatDateTime(released.at)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">AI check</dt>
            <dd>
              {m.aiCheck?.verdict === "verified"
                ? "Verified from the delivered files"
                : m.aiCheck?.verdict === "claimed_only"
                  ? "Claimed only (approved by client)"
                  : "—"}
            </dd>
          </div>
          {m.confirmedOnsiteAt && (
            <div>
              <dt className="text-slate-500">On-site check</dt>
              <dd suppressHydrationWarning>
                {m.kind === "materials" ? "Materials arrival confirmed" : "Confirmed"} with completion code ·{" "}
                {formatDateTime(m.confirmedOnsiteAt)}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-slate-500">PayPal payment</dt>
            <dd className="font-mono">{mask(m.captureId)}</dd>
          </div>
        </dl>

        {/* Requirements checklist (no private notes) */}
        {m.aiCheck?.checklist && m.aiCheck.checklist.length > 0 && (
          <>
            <h3 className="mt-6 text-sm font-semibold">Requirements checked</h3>
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {m.aiCheck.checklist.map((c) => (
                <li key={c.requirement}>
                  {c.met === "yes" ? "✓" : c.met === "no" ? "✗" : "?"} {c.requirement}
                </li>
              ))}
            </ul>
          </>
        )}

        {/* File fingerprints (no downloads) */}
        {m.beforePhotos && m.beforePhotos.length > 0 && (
          <>
            <h3 className="mt-6 text-sm font-semibold">Before photos &amp; fingerprints</h3>
            <ul className="mt-2 flex flex-col gap-1 font-mono text-xs text-slate-600">
              {m.beforePhotos.map((d) => (
                <li key={d.id} className="break-all">
                  {d.name} · {d.sha256 ? short(d.sha256) : "not fingerprinted"}
                </li>
              ))}
            </ul>
          </>
        )}
        {m.deliverables && m.deliverables.length > 0 && (
          <>
            <h3 className="mt-6 text-sm font-semibold">
              {m.beforePhotos?.length ? "After photos" : "Delivered items"} &amp; fingerprints
            </h3>
            <ul className="mt-2 flex flex-col gap-1 font-mono text-xs text-slate-600">
              {m.deliverables.map((d) => (
                <li key={d.id} className="break-all">
                  {d.kind === "file" ? d.name : "link"} · {d.sha256 ? short(d.sha256) : "not fingerprinted"}
                </li>
              ))}
            </ul>
          </>
        )}

        {/* Certificate ID = fingerprint of the payout step */}
        <div className="mt-6 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
          <p>
            Certificate ID: <span className="font-mono">{released.hash.slice(0, 16)}</span>
          </p>
          <p className="mt-1">
            {intact
              ? "✓ The deal's recorded history is intact — every step is chained by SHA-256 fingerprints."
              : "⚠ The deal's recorded history has been altered since it was written."}
          </p>
        </div>
      </div>

      {/* The history behind it */}
      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold">How this delivery happened</h2>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <Timeline deal={deal} milestoneId={m.id} hideProof />
        </div>
      </section>
    </main>
  );
}
