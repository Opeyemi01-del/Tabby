// Used by "use client" pages to call our API routes (src/app/api/...).
// Sends JSON, and turns an { error } reply into a thrown Error whose
// message can be shown straight to the user.
export async function postJson<T>(url: string, body: unknown = {}): Promise<T> {
  return send<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Same, but for forms with file uploads.
export async function postForm<T>(url: string, form: FormData): Promise<T> {
  return send<T>(url, { method: "POST", body: form });
}

async function send<T>(url: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new Error("Network problem — check your connection and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}
