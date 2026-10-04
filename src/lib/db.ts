// DATABASE — saves deals so they survive a page refresh.
// Uses SQLite, which is built into Node.js (no extra install).
// Each deal is stored as one JSON row; on first run the table is
// filled with the sample deals so the app never starts empty.
// Server-only: never import this from a "use client" file.
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { sampleDeals } from "./sample-data";
import type { Deal } from "./types";

const DB_PATH = process.env.DATABASE_PATH ?? path.join(process.cwd(), "tabby.db");

// Keep one connection, even when the dev server hot-reloads this file.
const globalForDb = globalThis as unknown as { tabbyDb?: DatabaseSync };

function db(): DatabaseSync {
  if (globalForDb.tabbyDb) return globalForDb.tabbyDb;

  const conn = new DatabaseSync(DB_PATH);
  conn.exec("CREATE TABLE IF NOT EXISTS deals (id TEXT PRIMARY KEY, data TEXT NOT NULL)");

  const { count } = conn.prepare("SELECT COUNT(*) AS count FROM deals").get() as { count: number };
  if (count === 0) {
    const insert = conn.prepare("INSERT INTO deals (id, data) VALUES (?, ?)");
    for (const deal of sampleDeals) insert.run(deal.id, JSON.stringify(deal));
  }

  globalForDb.tabbyDb = conn;
  return conn;
}

export function listDeals(): Deal[] {
  const rows = db().prepare("SELECT data FROM deals").all() as { data: string }[];
  return rows
    .map((row) => JSON.parse(row.data) as Deal)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)); // newest first
}

export function findDeal(id: string): Deal | undefined {
  const row = db().prepare("SELECT data FROM deals WHERE id = ?").get(id) as { data: string } | undefined;
  return row ? (JSON.parse(row.data) as Deal) : undefined;
}

// Insert a new deal or overwrite an existing one.
export function saveDeal(deal: Deal): void {
  db()
    .prepare("INSERT INTO deals (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data")
    .run(deal.id, JSON.stringify(deal));
}

// Finds which deal + milestone a PayPal order belongs to.
export function findByPaypalOrder(orderId: string) {
  for (const deal of listDeals()) {
    const milestone = deal.milestones.find((m) => m.paypalOrderId === orderId);
    if (milestone) return { deal, milestone };
  }
  return undefined;
}

// Finds the deal a PayPal authorization or capture belongs to.
export function findByPaypalPayment(paymentId: string) {
  for (const deal of listDeals()) {
    const milestone = deal.milestones.find(
      (m) => m.authorizationId === paymentId || m.captureId === paymentId,
    );
    if (milestone) return { deal, milestone };
  }
  return undefined;
}

// Finds the deal a PayPal payout batch belongs to.
export function findByPayoutBatch(batchId: string) {
  for (const deal of listDeals()) {
    const milestone = deal.milestones.find((m) => m.payout?.batchId === batchId);
    if (milestone) return { deal, milestone };
  }
  return undefined;
}

export function newDealId(): string {
  return `d-${Date.now().toString(36)}`;
}
