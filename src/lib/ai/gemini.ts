// GEMINI CONNECTOR — sends a prompt to Google's Gemini API and gets JSON back.
// Uses the REST API directly (no SDK to install).
// To switch AI providers later, write another file with the same
// `generateJson` function and pick it in ./index.ts.
import type { JsonSchema } from "./types";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export async function generateJson<T>(input: {
  system: string;
  prompt: string;
  schema: JsonSchema;
  // Optional images/PDFs for the AI to look at, each with a text label.
  attachments?: { label: string; mimeType: string; base64: string }[];
}): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set in .env.local");
  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  // Backup model, used when the main one is busy (503) or out of quota (429).
  // On by default; set GEMINI_FALLBACK_MODEL= (empty) in .env.local to turn it off.
  const fallback = process.env.GEMINI_FALLBACK_MODEL ?? "gemini-3.5-flash-lite";

  // The prompt first, then each attachment introduced by its label.
  const parts: object[] = [{ text: input.prompt }];
  for (const a of input.attachments ?? []) {
    parts.push({ text: `\n[Attachment: ${a.label}]` });
    parts.push({ inlineData: { mimeType: a.mimeType, data: a.base64 } });
  }

  const request: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: input.system }] },
      contents: [{ role: "user", parts }],
      generationConfig: {
        // Forces the reply to be JSON matching our schema.
        responseMimeType: "application/json",
        responseSchema: input.schema,
        temperature: 0.2, // low = more consistent answers
      },
    }),
  };
  const callModel = (name: string) =>
    fetchWithRetry(`${API_BASE}/${encodeURIComponent(name)}:generateContent`, request);

  let res = await callModel(model);
  if ((res.status === 429 || res.status === 503) && fallback && fallback !== model) {
    console.warn(`Gemini ${model} returned ${res.status}; trying backup model ${fallback}`);
    res = await callModel(fallback);
  }

  if (res.status === 429) throw new Error(quotaMessage(await res.text()));
  if (res.status === 503) {
    throw new Error("The AI is busy right now — please try again in a minute");
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini request failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error(`Gemini returned no answer (finish reason: ${data.candidates?.[0]?.finishReason ?? "unknown"})`);
  }
  return JSON.parse(text) as T;
}

// Explains a 429 "limit reached" error in plain words. Google says which
// limit was hit (per minute or per day) and how long to wait.
function quotaMessage(body: string): string {
  console.warn("Gemini 429:", body.slice(0, 600));
  let limit = "";
  let retrySeconds = 0;
  try {
    const details = (JSON.parse(body).error?.details ?? []) as Record<string, unknown>[];
    for (const d of details) {
      const violations = d.violations as { quotaId?: string; quotaMetric?: string }[] | undefined;
      if (violations?.[0]) limit = `${violations[0].quotaId ?? ""} ${violations[0].quotaMetric ?? ""}`;
      if (typeof d.retryDelay === "string") retrySeconds = parseFloat(d.retryDelay);
    }
  } catch {
    // not JSON — fall through to the general message
  }

  if (/PerDay/i.test(limit)) {
    return "Today's free AI limit is used up. It resets at midnight US Pacific time (around 8 AM in Nigeria).";
  }
  if (/PerMinute/i.test(limit) || retrySeconds > 0) {
    return `Too many AI requests in a short time — try again in ${Math.max(1, Math.ceil(retrySeconds || 60))} seconds.`;
  }
  return "AI usage limit reached (free tier) — wait a little, or try again later today";
}

// Tries up to 3 times when the network drops, a try takes over 90s,
// or Google is briefly busy (5xx), waiting a little longer each time.
// (Not on 429 "limit reached" — retrying would just use up more quota.)
// (90s because uploading files to the AI is slow on weak connections.)
async function fetchWithRetry(url: string, init: RequestInit, attempts = 3): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(90_000) });
      if (res.status >= 500 && attempt < attempts) {
        await new Promise((r) => setTimeout(r, attempt * 1500));
        continue;
      }
      return res;
    } catch (err) {
      if (attempt >= attempts) {
        console.error(err);
        throw new Error("Couldn't reach the AI — check your internet connection and try again");
      }
      await new Promise((r) => setTimeout(r, attempt * 1500));
    }
  }
}
