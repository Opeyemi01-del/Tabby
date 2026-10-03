// DELIVERABLES — the actual work the freelancer hands in (layer 2).
// Uploaded files are saved to disk and fingerprinted (SHA-256).
// Links are fetched by the SERVER so the AI reads the real page,
// not the freelancer's description of it.
// The result is a list of "evidence" the AI can inspect.
// Server-only.
import { createHash, randomBytes } from "node:crypto";
import { lookup } from "node:dns/promises";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { isIP } from "node:net";
import path from "node:path";
import type { Deliverable } from "./types";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");

export const LIMITS = {
  files: 5,
  links: 3,
  fileBytes: 8 * 1024 * 1024, // 8 MB per file
  totalBytes: 12 * 1024 * 1024, // 12 MB in total (Gemini request limit)
  linkBytes: 5 * 1024 * 1024, // max we download from one link
  textChars: 30_000, // max text we pass to the AI per item
};

// What we pass to the AI: either text, or raw bytes it can look at.
export type Evidence =
  | { label: string; text: string }
  | { label: string; mimeType: string; base64: string };

// --- File types -----------------------------------------------------------

// Formats Gemini can look at directly (images, PDFs).
const VISUAL: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  pdf: "application/pdf",
};
// Formats we read as text (SVG is XML, so it's text too).
const TEXT: Record<string, string> = {
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  json: "application/json",
  html: "text/html",
  htm: "text/html",
  css: "text/css",
  svg: "image/svg+xml",
};

function extensionOf(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function newId(): string {
  return randomBytes(12).toString("base64url");
}

// --- Uploaded files ---------------------------------------------------------

// Saves one uploaded file and returns its record + what the AI should see.
export async function saveUploadedFile(file: File): Promise<{ deliverable: Deliverable; evidence?: Evidence }> {
  const bytes = Buffer.from(await file.arrayBuffer());
  const name = file.name.slice(0, 120) || "file";
  const ext = extensionOf(name);
  const id = newId();

  await mkdir(UPLOAD_DIR, { recursive: true });
  // Saved under the random id only — the user's file name never touches the path.
  await writeFile(path.join(UPLOAD_DIR, id), bytes);

  const base = { id, kind: "file" as const, name, size: bytes.length, sha256: sha256(bytes) };
  const label = `File "${name}"`;

  if (VISUAL[ext]) {
    return {
      deliverable: { ...base, mimeType: VISUAL[ext], aiReadable: true },
      evidence: { label, mimeType: VISUAL[ext], base64: bytes.toString("base64") },
    };
  }
  if (TEXT[ext]) {
    return {
      deliverable: { ...base, mimeType: TEXT[ext], aiReadable: true },
      evidence: { label, text: bytes.toString("utf8").slice(0, LIMITS.textChars) },
    };
  }
  return {
    deliverable: {
      ...base,
      mimeType: "application/octet-stream",
      aiReadable: false,
      aiNote: `The AI can't open .${ext || "unknown"} files. Export it as PDF or an image to have it verified.`,
    },
  };
}

// Reads a saved upload back (for downloads).
export async function readUploadedFile(id: string): Promise<Buffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error("Bad file id");
  return readFile(path.join(UPLOAD_DIR, id));
}

// --- Links ------------------------------------------------------------------

// Blocks addresses inside private networks, so nobody can use Tabby to
// peek at the server's own machine or network ("SSRF").
function isPrivateAddress(ip: string): boolean {
  if (ip.startsWith("::ffff:")) ip = ip.slice(7); // IPv4 written as IPv6
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  const v6 = ip.toLowerCase();
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe8") ||
    v6.startsWith("fe9") || v6.startsWith("fea") || v6.startsWith("feb");
}

async function assertPublicUrl(url: URL) {
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Only http(s) links are allowed");
  if (url.username || url.password) throw new Error("Links with passwords aren't allowed");
  if (url.port && url.port !== "80" && url.port !== "443") throw new Error("Unusual ports aren't allowed");
  const addresses = await lookup(url.hostname, { all: true });
  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new Error("That address isn't publicly reachable");
  }
}

// Public Google Docs: fetch the plain-text export instead of the
// JavaScript-heavy viewer page, so the AI gets the real words.
function rewriteKnownLinks(url: URL): URL {
  const doc = url.hostname === "docs.google.com" && url.pathname.match(/^\/document\/d\/([\w-]+)/);
  return doc ? new URL(`https://docs.google.com/document/d/${doc[1]}/export?format=txt`) : url;
}

// Downloads a link (following up to 3 redirects, each one re-checked).
async function fetchPublic(start: URL): Promise<{ bytes: Buffer; contentType: string }> {
  let url = start;
  for (let hop = 0; hop < 4; hop++) {
    await assertPublicUrl(url);
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
      headers: { "User-Agent": "TabbyDeliveryCheck/1.0" },
    });
    const next = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && next) {
      url = new URL(next, url);
      continue;
    }
    if (!res.ok) throw new Error(`The link returned an error (${res.status})`);

    // Read at most LIMITS.linkBytes.
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > LIMITS.linkBytes) {
        await reader.cancel();
        throw new Error("The linked file is too large for the AI to check");
      }
      chunks.push(value);
    }
    return { bytes: Buffer.concat(chunks), contentType: (res.headers.get("content-type") ?? "").split(";")[0].trim() };
  }
  throw new Error("Too many redirects");
}

// Turns an HTML page into readable text for the AI.
function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

// Fetches one link and returns its record + what the AI should see.
export async function checkLink(raw: string): Promise<{ deliverable: Deliverable; evidence?: Evidence }> {
  const base = { id: newId(), kind: "link" as const, name: raw.slice(0, 500) };
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { deliverable: { ...base, aiReadable: false, aiNote: "Not a valid link" } };
  }

  try {
    const { bytes, contentType } = await fetchPublic(rewriteKnownLinks(url));
    const label = `Link ${raw}`;
    const visual = Object.values(VISUAL).includes(contentType);

    if (visual) {
      return {
        deliverable: { ...base, mimeType: contentType, sha256: sha256(bytes), aiReadable: true },
        evidence: { label, mimeType: contentType, base64: bytes.toString("base64") },
      };
    }
    const isText = contentType.startsWith("text/") || contentType === "application/json";
    if (!isText) {
      return { deliverable: { ...base, aiReadable: false, aiNote: `The AI can't read ${contentType || "this kind of"} content` } };
    }

    const text = contentType === "text/html" ? htmlToText(bytes.toString("utf8")) : bytes.toString("utf8");
    return {
      deliverable: { ...base, mimeType: contentType, sha256: sha256(bytes), aiReadable: true },
      evidence: { label, text: text.slice(0, LIMITS.textChars) || "(the page was empty)" },
    };
  } catch (err) {
    return {
      deliverable: { ...base, aiReadable: false, aiNote: `Couldn't open the link: ${(err as Error).message}` },
    };
  }
}
