// DISPUTE CENTER ("/disputes") — every deal where a client opened a
// PayPal dispute, with the evidence pack the AI put together.
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { getAllDeals } from "@/lib/deals";
import { formatDate, formatMoney } from "@/lib/format";

export default function DisputesPage() {
  const disputedDeals = getAllDeals().filter((deal) => deal.dispute);

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-semibold">Disputes</h1>
        <p className="mt-1 text-slate-600">
          When a client disputes a payment, Tabby&apos;s AI gathers your evidence from the agreement and your delivery.
        </p>

        {disputedDeals.length === 0 && <p className="mt-8 text-slate-500">No disputes. Nice work!</p>}

        {disputedDeals.map((deal) => {
          const dispute = deal.dispute!;
          const milestone = deal.milestones.find((m) => m.id === dispute.milestoneId);

          return (
            <section key={dispute.id} className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Link href={`/deals/${deal.id}`} className="font-semibold hover:underline">
                    {deal.title}
                  </Link>
                  <p className="text-sm text-slate-500">
                    {deal.clientName} · PayPal case {dispute.id} · opened {formatDate(dispute.openedAt)}
                  </p>
                </div>
                <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-200">
                  {dispute.status === "open" ? "Open" : dispute.status.replace("_", " ")}
                </span>
              </div>

              <p className="mt-3 text-sm">
                <span className="font-medium">Client&apos;s reason:</span> {dispute.reason}
                {milestone && (
                  <>
                    {" "}
                    · <span className="font-medium">Amount:</span> {formatMoney(milestone.amount)} ({milestone.title})
                  </>
                )}
              </p>

              {/* The AI-built evidence pack */}
              <h2 className="mt-5 text-sm font-semibold">AI evidence pack</h2>
              <ol className="mt-2 flex flex-col gap-2">
                {dispute.evidence.map((item, i) => (
                  <li key={item.title} className="rounded-lg bg-slate-50 p-3 text-sm">
                    <span className="font-medium">
                      {i + 1}. {item.title}
                    </span>
                    <p className="mt-1 text-slate-600">{item.detail}</p>
                  </li>
                ))}
              </ol>

              <button
                disabled
                className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white opacity-60"
              >
                Submit evidence to PayPal (coming in step 2)
              </button>
            </section>
          );
        })}
      </main>
    </>
  );
}
