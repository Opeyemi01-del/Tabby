// CLIENT REVIEW KEY — proves "this is the person who paid".
// When the client's PayPal payment is held, the server creates a random
// secret key and gives it ONLY to the browser that paid (as a cookie, plus
// a private review link). Approving or rejecting work requires that key, so
// the freelancer can't approve their own work.
// We store only a fingerprint (hash) of the key, never the key itself.
// Server-only.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { Deal } from "./types";

const cookieName = (dealId: string) => `tabby_client_${dealId}`;

function hash(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

// Creates a new key for a deal. Returns the key (to hand to the client)
// and its hash (to save on the deal).
export function newClientKey(): { key: string; keyHash: string } {
  const key = randomBytes(32).toString("base64url");
  return { key, keyHash: hash(key) };
}

// Does this key belong to this deal? (Constant-time compare.)
export function isValidClientKey(deal: Deal, key: string | null | undefined): boolean {
  if (!deal.clientKeyHash || !key) return false;
  const a = Buffer.from(hash(key), "hex");
  const b = Buffer.from(deal.clientKeyHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

// Saves the key in the client's browser for 60 days.
export async function setClientKeyCookie(dealId: string, key: string) {
  (await cookies()).set(cookieName(dealId), key, {
    httpOnly: true, // page scripts can't read it
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 60,
  });
}

// Reads the key from the cookie, or from a ?key= in the review link.
export async function getClientKey(dealId: string, fromLink?: string | null): Promise<string | undefined> {
  return fromLink || (await cookies()).get(cookieName(dealId))?.value;
}
