// The naira exchange rate: NGN_PER_USD in .env.local (or the host's
// settings). Update it to today's rate; empty = hidden.
// Server-only, read while the site runs, so changing it on the host needs
// no rebuild. (Names starting with NEXT_PUBLIC_ are copied into the code at
// build time instead — that older name still works, but only after a rebuild.)
export function ngnPerUsd(): number | null {
  const rate = Number(process.env.NGN_PER_USD || process.env.NEXT_PUBLIC_NGN_PER_USD);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}
