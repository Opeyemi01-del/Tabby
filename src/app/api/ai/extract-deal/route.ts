// POST /api/ai/extract-deal  ->  draft deal from the AI
// Accepts either:
//   JSON  { chat }                          (pasted text)
//   Form  chat? + screenshots (up to 3)      (e.g. WhatsApp screenshots)
// Either way it's ONE AI call, so it costs the same on the free tier.
import { extractDeal, type ChatImage } from "@/lib/ai";
import { handleError, jsonError, readJson } from "@/lib/api";

const MAX_SCREENSHOTS = 3;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB each
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

export async function POST(req: Request) {
  let chat = "";
  const images: ChatImage[] = [];

  if (req.headers.get("content-type")?.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return jsonError("Couldn't read the upload — please try again");
    }
    chat = String(form.get("chat") ?? "");
    const files = form.getAll("screenshots").filter((f): f is File => f instanceof File && f.size > 0);

    if (files.length > MAX_SCREENSHOTS) return jsonError(`Upload at most ${MAX_SCREENSHOTS} screenshots`);
    for (const f of files) {
      if (!IMAGE_TYPES.includes(f.type)) return jsonError(`"${f.name}" isn't a PNG, JPG or WebP image`);
      if (f.size > MAX_IMAGE_BYTES) return jsonError(`"${f.name}" is over 5 MB`);
      images.push({ mimeType: f.type, base64: Buffer.from(await f.arrayBuffer()).toString("base64") });
    }
  } else {
    const body = await readJson(req);
    chat = typeof body.chat === "string" ? body.chat : "";
  }

  if (chat.trim() === "" && images.length === 0) return jsonError("Paste a chat or upload screenshots first");
  if (chat.length > 20_000) return jsonError("That chat is too long — paste just the part about the deal");

  try {
    return Response.json(await extractDeal({ chat, images }));
  } catch (err) {
    return handleError(err);
  }
}
