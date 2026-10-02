// GEMINI CONNECTOR — sends a prompt to Google's Gemini API and gets JSON back.
// Uses the REST API directly (no SDK to install).
// To switch AI providers later, write another file with the same
// `generateJson` function and pick it in ./index.ts.
import type { JsonSchema } from "./types";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export async function generateJson<T>(input: { system: string; prompt: string; schema: JsonSchema }): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set in .env.local");
  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";

  const res = await fetchWithRetry(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: input.system }] },
      contents: [{ role: "user", parts: [{ text: input.prompt }] }],
      generationConfig: {
        // Forces the reply to be JSON matching our schema.
        responseMimeType: "application/json",
        responseSchema: input.schema,
        temperature: 0.2, // low = more consistent answers
      },
    }),
  });

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

// Tries up to 3 times when the network drops, a try takes over 60s,
// or Google is briefly busy (429 / 5xx), waiting a little longer each time.
async function fetchWithRetry(url: string, init: RequestInit, attempts = 3): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(60_000) });
      if ((res.status === 429 || res.status >= 500) && attempt < attempts) {
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
