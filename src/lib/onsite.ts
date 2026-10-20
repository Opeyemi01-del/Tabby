// ON-SITE JOBS — the completion code.
// The payer (often abroad) can't see the job, but someone at the place can.
// When the payer pays for an on-site milestone, Tabby makes a 6-digit
// code that only the payer sees. They send it to the person at the place,
// who gives it to the artisan once they're happy (job done, or materials
// arrived). The artisan enters it, and the milestone is marked "confirmed on-site".
// The code doesn't release money: the payer still approves.
// Server-only.
import { randomInt, timingSafeEqual } from "node:crypto";
import { readUploadedFile, saveUploadedFile, type Evidence } from "./deliverables";
import { short } from "./events";
import { formatDateTime, staleNote } from "./format";
import type { Deal, Deliverable, Milestone } from "./types";

export const MAX_CODE_TRIES = 5;

// Every milestone of an on-site job gets a code. For a work milestone it
// confirms the job is done; for a materials milestone, that the parts
// arrived at the place (the payer abroad can't check either).
export function usesCompletionCode(deal: Deal, _m?: Milestone): boolean {
  return deal.jobType === "onsite";
}

// What entering the code confirms, for messages: "the job is done" / "the materials arrived".
export function codeConfirms(m: Milestone): string {
  return m.kind === "materials" ? "the materials arrived" : "the job is done";
}

// "048213" — random, always 6 digits.
export function newCompletionCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

// Can a code be entered right now? null = yes, else why not.
export function codeBlocker(deal: Deal, m: Milestone): string | null {
  if (!usesCompletionCode(deal, m) || !m.completionCode) return "This milestone has no completion code";
  if (m.confirmedOnsiteAt) return "This job is already confirmed on-site";
  if (m.status !== "funds_held" && m.status !== "work_submitted") return "There's no held payment for this job";
  if ((m.codeTries ?? 0) >= MAX_CODE_TRIES) {
    return "Too many wrong codes — the code is locked. The payer can still approve from their review page.";
  }
  return null;
}

// Compares in constant time, so the answer's timing gives nothing away.
export function codeMatches(m: Milestone, entered: string): boolean {
  const a = Buffer.from(entered.replace(/\s/g, ""));
  const b = Buffer.from(m.completionCode ?? "");
  return a.length === b.length && b.length > 0 && timingSafeEqual(a, b);
}

// --- Before/after photos -----------------------------------------------------
// On-site WORK milestones are proven with photos: "before" when the job
// starts, "after" at delivery. The AI compares them against the agreement.
// The browser shrinks photos before upload; "takenAt" is the phone's own
// time for the photo, used to flag old gallery pictures.

export const PHOTO_LIMIT = 3;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function usesPhotos(deal: Deal, m: Milestone): boolean {
  return deal.jobType === "onsite" && m.kind !== "materials";
}

type Photo = { file: File; takenAt?: string };

// Reads form fields "photos" + "takenAt" (milliseconds, same order).
// Returns the photos, or an error message.
export function readPhotos(form: FormData): Photo[] | string {
  const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  const times = form.getAll("takenAt").map(Number);
  if (files.length === 0) return "Take at least one photo";
  if (files.length > PHOTO_LIMIT) return `Take at most ${PHOTO_LIMIT} photos`;
  if (files.some((f) => !PHOTO_TYPES.includes(f.type))) return "Photos must be JPG, PNG or WebP";
  if (files.some((f) => f.size > 8 * 1024 * 1024)) return "Each photo must be under 8 MB";

  const now = Date.now();
  return files.map((file, i) => {
    const t = times[i];
    // Ignore times that make no sense (in the future, or before 2020).
    const ok = Number.isFinite(t) && t > Date.UTC(2020, 0) && t < now + 5 * 60_000;
    return { file, takenAt: ok ? new Date(t).toISOString() : undefined };
  });
}

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export async function savePhotos(photos: Photo[]): Promise<Deliverable[]> {
  // Some phones send names like "image" with no extension; the saver goes
  // by the extension, so give each photo one that matches its type.
  const named = photos.map(({ file }) =>
    file.name.toLowerCase().endsWith(`.${EXT[file.type]}`)
      ? file
      : new File([file], `${file.name.replace(/\.\w*$/, "") || "photo"}.${EXT[file.type]}`, { type: file.type }),
  );
  const saved = await Promise.all(named.map(saveUploadedFile));
  return saved.map((s, i) => ({ ...s.deliverable, ...(photos[i].takenAt ? { takenAt: photos[i].takenAt } : {}) }));
}

// Loads saved photos back as AI evidence, labelled e.g.
// "BEFORE photo 1 (taken Oct 19, 2026, 10:42 AM)".
export async function photoEvidence(role: "BEFORE" | "AFTER", photos: Deliverable[], uploadedAt?: string): Promise<Evidence[]> {
  return Promise.all(
    photos.map(async (p, i) => {
      const stale = staleNote(p.takenAt, uploadedAt);
      const when = p.takenAt ? `taken ${formatDateTime(p.takenAt)}` : "capture time unknown";
      return {
        label: `${role} photo ${i + 1} (${when}${stale ? `; WARNING: ${stale}` : ""})`,
        mimeType: p.mimeType ?? "image/jpeg",
        base64: (await readUploadedFile(p.id)).toString("base64"),
      };
    }),
  );
}

// "Photo IMG_1.jpg · a5da7734… · taken 2026-10-19T09:42:00.000Z" lines for
// the timeline (ISO time, so the recorded proof doesn't depend on a time zone).
export function photoProof(photos: Deliverable[]): string[] {
  return photos.map((p) => `Photo ${p.name} · ${p.sha256 ? short(p.sha256) : ""}${p.takenAt ? ` · taken ${p.takenAt}` : ""}`);
}

// A copy of the milestone without the code, for the ARTISAN's page.
// (Anything passed to a "use client" component ends up in the browser.)
export function withoutCode(m: Milestone): Milestone {
  const { completionCode: _hidden, ...rest } = m;
  void _hidden;
  return rest;
}
