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

  // The prompt first, then each attachment introduced by its label.
  const parts: object[] = [{ text: input.prompt }];
  for (const a of input.attachments ?? []) {
    parts.push({ text: `\n[Attachment: ${a.label}]` });
    parts.push({ inlineData: { mimeType: a.mimeType, data: a.base64 } });
  }

  const res = await fetchWithRetry(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
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
  });

  if (res.status === 429) {
    console.warn("Gemini 429:", (await res.text()).slice(0, 300));
    throw new Error("AI usage limit reached (free tier) — wait a little, or try again later today");
  }
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
