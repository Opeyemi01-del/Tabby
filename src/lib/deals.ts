// Helpers for reading deals. Pages call these instead of touching the
// database directly. Server-only (the database lives on the server).
import { findDeal, listDeals } from "./db";
import type { Deal, Status } from "./types";

export function getAllDeals(): Deal[] {
  return listDeals();
}

export function getDeal(id: string): Deal | undefined {
  return findDeal(id);
}

export function dealTotal(deal: Deal): number {
  return deal.milestones.reduce((sum, m) => sum + m.amount, 0);
}

// A deal's overall status comes from its milestones:
// any dispute wins, then the first milestone that isn't finished yet
// (paid or refunded). If all are finished: "released" if anything was paid.
export function dealStatus(deal: Deal): Status {
  if (deal.milestones.some((m) => m.status === "disputed")) return "disputed";
  const current = deal.milestones.find((m) => m.status !== "released" && m.status !== "refunded");
  if (current) return current.status;
  return deal.milestones.some((m) => m.status === "released") ? "released" : "refunded";
}

// Is anything in this deal still waiting for someone? (Used to decide
// whether pages should keep checking for updates.)
export function dealIsActive(deal: Deal): boolean {
  return deal.milestones.some(
    (m) =>
      m.status === "awaiting_payment" ||
      m.status === "funds_held" ||
      m.status === "work_submitted" ||
      (m.status === "released" && m.payout?.status === "pending"),
  );
}

// Adds up money across all deals, grouped by milestone status
// (used for the numbers at the top of the dashboard).
export function totalsByStatus(deals: Deal[]): Record<Status, number> {
  const totals: Record<Status, number> = {
    awaiting_payment: 0,
    funds_held: 0,
    work_submitted: 0,
    released: 0,
    refunded: 0,
    disputed: 0,
  };
  for (const deal of deals) {
    for (const m of deal.milestones) totals[m.status] += m.amount;
  }
  return totals;
}
