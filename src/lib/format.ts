// Small helpers to display money and dates consistently.

export function formatMoney(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

// Approximate naira value of a USD amount, e.g. 60 -> "≈ ₦90,000".
// The rate is set in .env.local as NEXT_PUBLIC_NGN_PER_USD (the
// NEXT_PUBLIC_ prefix lets the browser read it). Update it to today's rate.
export function formatNaira(usd: number): string | null {
  const rate = Number(process.env.NEXT_PUBLIC_NGN_PER_USD);
  if (!Number.isFinite(rate) || rate <= 0) return null; // not set: show nothing
  const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });
  return `≈ ${naira.format(usd * rate)}`;
}

// "2026-10-10T14:30:00Z" -> "Oct 10, 2026, 3:30 PM" (in the viewer's time zone)
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// On-site photos: a warning if the photo is much older than its upload
// (likely picked from the gallery), else null. 30 minutes of slack.
export function staleNote(takenAt: string | undefined, uploadedAt: string | undefined): string | null {
  if (!uploadedAt) return null;
  if (!takenAt) return "No capture time — may not be a fresh photo";
  const minutes = (Date.parse(uploadedAt) - Date.parse(takenAt)) / 60_000;
  if (minutes <= 30) return null;
  const age = minutes < 120 ? `${Math.round(minutes)} min` : minutes < 2880 ? `${Math.round(minutes / 60)} h` : `${Math.round(minutes / 1440)} days`;
  return `Taken ${age} before upload — may not be a fresh photo`;
}

// "2026-10-10" -> "Oct 10, 2026"
export function formatDate(isoDate: string): string {
  return new Date(isoDate + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
