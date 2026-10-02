// Helpers for reading deals. Pages call these instead of touching the
// sample data directly, so in step 2 we only swap the inside of these
// functions for database/PayPal calls — the pages stay the same.
import { sampleDeals } from "./sample-data";
import type { Deal, Status } from "./types";

export function getAllDeals(): Deal[] {
  return sampleDeals;
}

export function getDeal(id: string): Deal | undefined {
  return sampleDeals.find((deal) => deal.id === id);
}

export function dealTotal(deal: Deal): number {
  return deal.milestones.reduce((sum, m) => sum + m.amount, 0);
}

// A deal's overall status comes from its milestones:
// any dispute wins, then the first milestone that isn't paid yet.
export function dealStatus(deal: Deal): Status {
  if (deal.milestones.some((m) => m.status === "disputed")) return "disputed";
  const current = deal.milestones.find((m) => m.status !== "released");
  return current ? current.status : "released";
}

// Adds up money across all deals, grouped by milestone status
// (used for the numbers at the top of the dashboard).
export function totalsByStatus(deals: Deal[]): Record<Status, number> {
  const totals: Record<Status, number> = {
    awaiting_payment: 0,
    funds_held: 0,
    work_submitted: 0,
    released: 0,
    disputed: 0,
  };
  for (const deal of deals) {
    for (const m of deal.milestones) totals[m.status] += m.amount;
  }
  return totals;
}
