// POST /api/ai/extract-deal   { chat }  ->  draft deal from the AI
import { extractDeal } from "@/lib/ai";
import { handleError, jsonError, readJson } from "@/lib/api";

export async function POST(req: Request) {
  const { chat } = await readJson(req);
  if (typeof chat !== "string" || chat.trim() === "") return jsonError("Paste a chat first");
  if (chat.length > 20_000) return jsonError("That chat is too long — paste just the part about the deal");

  try {
    return Response.json(await extractDeal(chat));
  } catch (err) {
    return handleError(err);
  }
}
