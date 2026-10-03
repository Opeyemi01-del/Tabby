// GET /api/deals/{id}/files/{fileId} — download a delivered file.
// Images open in the browser; everything else downloads, so an uploaded
// HTML or SVG file can never run scripts on Tabby's pages.
import { jsonError } from "@/lib/api";
import { findDeal } from "@/lib/db";
import { readUploadedFile } from "@/lib/deliverables";

const SAFE_TO_SHOW = ["image/png", "image/jpeg", "image/webp"];

export async function GET(_req: Request, ctx: RouteContext<"/api/deals/[id]/files/[fileId]">) {
  const { id, fileId } = await ctx.params;
  const file = findDeal(id)
    ?.milestones.flatMap((m) => m.deliverables ?? [])
    .find((d) => d.id === fileId && d.kind === "file");
  if (!file) return jsonError("File not found", 404);

  let bytes: Buffer;
  try {
    bytes = await readUploadedFile(file.id);
  } catch {
    return jsonError("File not found", 404);
  }

  const inline = SAFE_TO_SHOW.includes(file.mimeType ?? "");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": inline ? file.mimeType! : "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox",
    },
  });
}
