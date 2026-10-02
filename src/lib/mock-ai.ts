// PRETEND AI — fakes what Gemini will do, so the screens work today.
// In step 2 these functions will call our real AI API route instead.
// Pages import from here, so they won't need to change.

export type ExtractedDeal = {
  title: string;
  clientName: string;
  clientEmail: string;
  milestones: { title: string; amount: number }[];
};

// Waits a moment so it feels like the AI is "thinking".
function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Turns a pasted client chat into a draft deal.
// Fake version: grabs the first "$123" in the text, splits it 50/50.
export async function extractDealFromChat(chat: string): Promise<ExtractedDeal> {
  await wait(1200);
  const match = chat.match(/\$\s?([\d,]+)/);
  const total = match ? Number(match[1].replace(/,/g, "")) : 500;
  const half = Math.round(total / 2);
  return {
    title: "New project",
    clientName: "",
    clientEmail: "",
    milestones: [
      { title: "Deposit — start of work", amount: half },
      { title: "Final delivery", amount: total - half },
    ],
  };
}

// Compares what the freelancer delivered with the agreement.
// Fake version: passes anything with a reasonable description.
export async function checkDelivery(deliveryNote: string): Promise<{
  verdict: "pass" | "concerns";
  summary: string;
}> {
  await wait(1500);
  if (deliveryNote.trim().length < 20) {
    return {
      verdict: "concerns",
      summary: "The delivery note is too short to confirm it matches the agreement. Add links or details.",
    };
  }
  return {
    verdict: "pass",
    summary: "The delivery appears to match what was agreed in the chat.",
  };
}
