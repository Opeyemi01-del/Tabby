// Small helpers to display money and dates consistently.

export function formatMoney(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
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

// "2026-10-10" -> "Oct 10, 2026"
export function formatDate(isoDate: string): string {
  return new Date(isoDate + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
