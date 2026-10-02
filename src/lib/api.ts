// Small helpers shared by the API routes in src/app/api/.
import { PayPalError } from "./paypal";

// Reply with an error message the page can show.
export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

// Turns any thrown error into a sensible reply.
export function handleError(err: unknown) {
  console.error(err);
  if (err instanceof PayPalError) return jsonError(`PayPal: ${err.message}`, 502);
  return jsonError(err instanceof Error ? err.message : "Something went wrong", 500);
}

// Reads the JSON body; returns {} if it's missing or broken.
export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

// "2026-10-01" style date, `days` from today.
export function isoDateInDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
