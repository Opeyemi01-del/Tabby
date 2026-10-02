// DASHBOARD ("/dashboard") — the freelancer's overview of all deals.
import Link from "next/link";
import Navbar from "@/components/Navbar";
import StatCard from "@/components/StatCard";
import DealCard from "@/components/DealCard";
import { getAllDeals, totalsByStatus } from "@/lib/deals";
import { formatMoney } from "@/lib/format";

// Always read fresh data from the database (never a cached copy).
export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const deals = getAllDeals();
  const totals = totalsByStatus(deals);

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <Link href="/deals/new" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            + New deal
          </Link>
        </div>

        {/* Money summary */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Paid to you" value={formatMoney(totals.released)} />
          <StatCard
            label="Held by PayPal"
            value={formatMoney(totals.funds_held + totals.work_submitted)}
            hint="Released when work is approved"
          />
          <StatCard label="Awaiting payment" value={formatMoney(totals.awaiting_payment)} />
          <StatCard label="In dispute" value={formatMoney(totals.disputed)} />
        </div>

        {/* Deal list */}
        <h2 className="mb-3 mt-8 text-lg font-semibold">Your deals</h2>
        <div className="flex flex-col gap-3">
          {deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} />
          ))}
        </div>
      </main>
    </>
  );
}
