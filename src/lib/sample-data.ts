// SAMPLE DEALS — built-in examples so visitors (and judges) can see every
// step of Tabby without paying first. They're marked `sample: true`: they
// have no real PayPal payments, so actions that move money are refused
// (see sampleOnly() in api.ts) and the sample dispute is only simulated.
// Dates are worked out from today, so the examples never look stale.
// Photos and files come from demo-files/ (copied into the uploads folder);
// a missing file is simply left out. All people here are made up.
// Server-only.
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { addEvent, sha256Text, short } from "./events";
import type { Deal, Deliverable } from "./types";

const DEMO_DIR = path.join(process.cwd(), "demo-files");
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");

// Old example deals, removed when the current ones are added.
export const LEGACY_SAMPLE_IDS = ["d-1001", "d-1002", "d-1003", "d-1004", "d-sample-pipe"];

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const dateIn = (days: number) => new Date(Date.now() + days * DAY).toISOString().slice(0, 10);

// One file from demo-files/ as a delivered item (copied into the uploads
// folder under a fixed id). Returns [] if the file isn't there.
function demoFile(fileName: string, id: string, takenAt?: string): Deliverable[] {
  const source = path.join(DEMO_DIR, fileName);
  if (!existsSync(source)) return [];
  mkdirSync(UPLOAD_DIR, { recursive: true });
  const target = path.join(UPLOAD_DIR, id);
  if (!existsSync(target)) copyFileSync(source, target);
  const bytes = readFileSync(source);
  const ext = fileName.split(".").pop()?.toLowerCase();
  return [
    {
      id,
      kind: "file",
      name: fileName,
      mimeType: ext === "png" ? "image/png" : "image/jpeg",
      size: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      aiReadable: true,
      ...(takenAt ? { takenAt } : {}),
    },
  ];
}

const proofOf = (items: Deliverable[]) => items.map((d) => `File ${d.name} · ${short(d.sha256 ?? "")}`);

// --- 1. The diaspora story: an on-site job paid from abroad ----------------
function roomCleaning(): Deal {
  const startedAt = ago(3 * DAY + 2 * HOUR);
  const finishedAt = ago(3 * DAY - 2 * HOUR);
  const before = demoFile("room-before.jpg", "sample-room-before", ago(3 * DAY + 2 * HOUR + 5 * 60_000));
  const after = demoFile("room-after.jpg", "sample-room-after", ago(3 * DAY - 2 * HOUR + 4 * 60_000));
  const hasPhotos = before.length > 0 && after.length > 0;

  const deal: Deal = {
    id: "d-sample-clean",
    sample: true,
    title: "Deep clean of Mum's bedroom",
    clientName: "Tunde Bakare",
    clientEmail: "tunde.bakare@example.com",
    currency: "USD",
    createdAt: ago(5 * DAY).slice(0, 10),
    agreement:
      "Tunde: Hi Chioma, my mum comes home from the hospital on Saturday. I'm in London — can you deep-clean her bedroom in Surulere before then?\n" +
      "Chioma: Yes sir. $15 first for cleaning supplies, then $45 for the cleaning.\n" +
      "Tunde: OK. My sister will be at the house. She'll check the room before I release anything.\n" +
      "Chioma: No problem. I'll clear the floor, sweep and mop, make the bed with clean sheets and put everything away.",
    payoutEmail: "chioma.cleaning@example.com",
    jobType: "onsite",
    jobLocation: "Surulere, Lagos",
    milestones: [
      {
        id: "m-1",
        kind: "materials",
        title: "Cleaning supplies",
        amount: 15,
        dueDate: dateIn(-3),
        status: "released",
        deliveryNote: "Bought detergent, disinfectant, a new mop head and bin bags. Your sister saw them before I started.",
        submittedAt: ago(4 * DAY),
        aiCheck: {
          verdict: "claimed_only",
          summary:
            "No receipt was uploaded, so the purchase rests on the artisan's word — but the client's family confirmed on-site with the completion code that the materials arrived.",
        },
        confirmedOnsiteAt: ago(4 * DAY - HOUR),
        releasedBy: "client",
        netAmount: 13.99,
        payout: { status: "sent", amount: 13.99, batchId: "SAMPLE-BATCH-1" },
        authorizationId: "SAMPLE-AUTH-1",
        captureId: "SAMPLE-CAP-1",
      },
      {
        id: "m-2",
        title: "Deep clean of the bedroom",
        amount: 45,
        dueDate: dateIn(-1),
        status: "released",
        deliveryNote: "Cleared and mopped the floor, changed the sheets, folded the clothes and took out 2 bags of rubbish.",
        beforePhotos: before,
        startedAt,
        deliverables: after,
        submittedAt: finishedAt,
        aiCheck: hasPhotos
          ? {
              verdict: "verified",
              summary:
                "The after photo shows the same bedroom — same curtains, tiled wall and floor — with the bed made and the bag, shoes and clutter cleared from the floor, matching the agreed clean.",
              checklist: [
                { requirement: "Floor cleared, swept and mopped", met: "yes", note: "Bag, shoes and items gone from the floor; shoes lined up by the wall" },
                { requirement: "Bed made with clean sheets", met: "yes", note: "Bedspread laid flat with the pillow in place" },
                { requirement: "Clothes and clutter put away", met: "yes", note: "Nothing left lying on the bed or the floor" },
                { requirement: "Same room as the before photo", met: "yes", note: "Same curtains, tiled wall, speaker and floor pattern" },
              ],
            }
          : {
              verdict: "claimed_only",
              summary: "No photos were attached to this sample, so the clean rests on the cleaner's note.",
            },
        confirmedOnsiteAt: ago(3 * DAY - HOUR),
        releasedBy: "client",
        netAmount: 42.94,
        payout: { status: "sent", amount: 42.94, batchId: "SAMPLE-BATCH-2" },
        authorizationId: "SAMPLE-AUTH-2",
        captureId: "SAMPLE-CAP-2",
      },
    ],
  };

  const e = (at: string, ev: Parameters<typeof addEvent>[1]) => addEvent(deal, { ...ev, at });
  e(ago(5 * DAY), {
    type: "deal_created",
    summary: "Agreement recorded from the client chat",
    proof: [`Agreement fingerprint ${short(sha256Text(deal.agreement))}`],
  });
  e(ago(5 * DAY - HOUR), { type: "payment_held", milestoneId: "m-1", summary: 'Client paid $15.00 for "Cleaning supplies" — held by PayPal', proof: ["PayPal authorization SAMPLE-AUTH-1"] });
  e(ago(4 * DAY - HOUR), { type: "onsite_confirmed", milestoneId: "m-1", summary: 'Confirmed on-site that the materials arrived: the person at the place gave the artisan the code for "Cleaning supplies"' });
  e(ago(4 * DAY - 30 * 60_000), { type: "released", milestoneId: "m-1", summary: "Client approved — $15.00 released to the freelancer", proof: ["PayPal capture SAMPLE-CAP-1 (COMPLETED)"] });
  e(ago(4 * DAY - 25 * 60_000), { type: "payout_sent", milestoneId: "m-1", summary: "$13.99 sent to the freelancer's PayPal", proof: ["PayPal payout batch SAMPLE-BATCH-1"] });
  e(ago(3 * DAY + 3 * HOUR), { type: "payment_held", milestoneId: "m-2", summary: 'Client paid $45.00 for "Deep clean of the bedroom" — held by PayPal', proof: ["PayPal authorization SAMPLE-AUTH-2"] });
  if (before.length) e(startedAt, { type: "work_started", milestoneId: "m-2", summary: 'Job started for "Deep clean of the bedroom": 1 before photo', proof: proofOf(before) });
  e(finishedAt, { type: "work_submitted", milestoneId: "m-2", summary: `Job finished for "Deep clean of the bedroom": ${after.length || "no"} after photo${after.length === 1 ? "" : "s"}`, proof: proofOf(after) });
  e(ago(3 * DAY - 2 * HOUR + 60_000), { type: "ai_checked", milestoneId: "m-2", summary: hasPhotos ? "AI check: verified from the files (4 of 4 requirements met)" : "AI check: claimed only" });
  e(ago(3 * DAY - HOUR), { type: "onsite_confirmed", milestoneId: "m-2", summary: 'Confirmed on-site that the job is done: the person at the place gave the artisan the code for "Deep clean of the bedroom"' });
  e(ago(3 * DAY - 40 * 60_000), { type: "released", milestoneId: "m-2", summary: "Client approved — $45.00 released to the freelancer", proof: ["PayPal capture SAMPLE-CAP-2 (COMPLETED)"] });
  e(ago(3 * DAY - 35 * 60_000), { type: "payout_sent", milestoneId: "m-2", summary: "$42.94 sent to the freelancer's PayPal", proof: ["PayPal payout batch SAMPLE-BATCH-2"] });
  return deal;
}

// --- 2. Digital work waiting for the client's review -----------------------
function instagramTemplates(): Deal {
  const files = [
    ...demoFile("instagram-template-1.png", "sample-insta-1"),
    ...demoFile("instagram-template-2.png", "sample-insta-2"),
    ...demoFile("instagram-template-3.png", "sample-insta-3"),
  ];
  const deal: Deal = {
    id: "d-sample-insta",
    sample: true,
    title: "Instagram post templates",
    clientName: "Sarah Mensah",
    clientEmail: "sarah@example.com",
    currency: "USD",
    createdAt: ago(4 * DAY).slice(0, 10),
    agreement:
      "Sarah: Can you make 3 Instagram post templates for my bakery? New arrivals, a sale, and a customer favourite.\n" +
      "You: Sure — $60. I'll use your brown and cream colours and leave space for photos.\n" +
      "Sarah: Perfect. Then a short logo animation for $40 next week.",
    payoutEmail: "designer@example.com",
    jobType: "digital",
    milestones: [
      {
        id: "m-1",
        title: "3 Instagram post templates",
        amount: 60,
        dueDate: dateIn(2),
        status: "work_submitted",
        deliveryNote: "All three templates attached as PNG, in your brand colours.",
        deliverables: files,
        submittedAt: ago(5 * HOUR),
        reviewDeadline: new Date(Date.now() + 2 * DAY).toISOString(),
        aiCheck:
          files.length === 3
            ? {
                verdict: "verified",
                summary: "All three templates were delivered as images and each matches one of the agreed themes.",
                checklist: [
                  { requirement: "3 templates", met: "yes", note: "Three PNG files attached" },
                  { requirement: "New arrivals, sale and favourite themes", met: "yes", note: "One template for each theme" },
                  { requirement: "Brand colours (brown and cream)", met: "yes", note: "All three use brown and cream" },
                ],
              }
            : {
                verdict: "claimed_only",
                summary: "No files were attached to this sample, so the delivery rests on the freelancer's note.",
              },
        authorizationId: "SAMPLE-AUTH-3",
      },
      {
        id: "m-2",
        title: "Short logo animation",
        amount: 40,
        dueDate: dateIn(9),
        status: "awaiting_payment",
      },
    ],
  };
  const e = (at: string, ev: Parameters<typeof addEvent>[1]) => addEvent(deal, { ...ev, at });
  e(ago(4 * DAY), { type: "deal_created", summary: "Agreement recorded from the client chat", proof: [`Agreement fingerprint ${short(sha256Text(deal.agreement))}`] });
  e(ago(4 * DAY - 2 * HOUR), { type: "payment_held", milestoneId: "m-1", summary: 'Client paid $60.00 for "3 Instagram post templates" — held by PayPal', proof: ["PayPal authorization SAMPLE-AUTH-3"] });
  e(ago(5 * HOUR), { type: "work_submitted", milestoneId: "m-1", summary: `Work delivered for "3 Instagram post templates": ${files.length || "no"} item${files.length === 1 ? "" : "s"}`, proof: proofOf(files) });
  e(ago(5 * HOUR - 60_000), { type: "ai_checked", milestoneId: "m-1", summary: files.length === 3 ? "AI check: verified from the files (3 of 3 requirements met)" : "AI check: claimed only" });
  return deal;
}

// --- 3. Waiting for payment -----------------------------------------------
function blogPosts(): Deal {
  const deal: Deal = {
    id: "d-sample-blog",
    sample: true,
    title: "Blog articles (5 posts)",
    clientName: "Amaka Eze",
    clientEmail: "amaka@example.com",
    currency: "USD",
    createdAt: ago(DAY).slice(0, 10),
    agreement:
      "Amaka: I need 5 blog posts about personal finance, ~1,000 words each. $300?\n" +
      "You: Works for me. Delivery in 2 weeks, paid in full upfront and held until delivery.",
    jobType: "digital",
    milestones: [{ id: "m-1", title: "5 articles, ~1,000 words each", amount: 300, dueDate: dateIn(13), status: "awaiting_payment" }],
  };
  addEvent(deal, { at: ago(DAY), type: "deal_created", summary: "Agreement recorded from the client chat", proof: [`Agreement fingerprint ${short(sha256Text(deal.agreement))}`] });
  return deal;
}

// --- 4. A client dispute after payment -------------------------------------
function uiKitDispute(): Deal {
  const deal: Deal = {
    id: "d-sample-uikit",
    sample: true,
    title: "Mobile app UI kit",
    clientName: "Northwind Apps",
    clientEmail: "pm@northwind.example.com",
    currency: "USD",
    createdAt: ago(20 * DAY).slice(0, 10),
    agreement:
      "Northwind: We need wireframes for 8 screens, then a full UI kit. $1,000 total.\n" +
      "You: $350 for the 8 wireframes, $650 for the UI kit.\n" +
      "Northwind: Approved. Wireframes within 10 days please.",
    jobType: "digital",
    milestones: [
      {
        id: "m-1",
        title: "Wireframes for 8 screens",
        amount: 350,
        dueDate: dateIn(-10),
        status: "disputed",
        deliveryNote: "All 8 wireframe screens are in the shared Figma file.",
        deliverables: [{ id: "sample-uikit-link", kind: "link", name: "Figma file — 8 wireframe screens (sample)", aiReadable: false, aiNote: "Sample link, not opened" }],
        submittedAt: ago(11 * DAY),
        aiCheck: { verdict: "claimed_only", summary: "The Figma file couldn't be opened by the AI, so the client approved the delivery themselves." },
        releasedBy: "client",
        netAmount: 337.29,
        authorizationId: "SAMPLE-AUTH-4",
        captureId: "SAMPLE-CAP-4",
      },
      { id: "m-2", title: "Full UI kit", amount: 650, dueDate: dateIn(5), status: "awaiting_payment" },
    ],
    dispute: {
      id: "PP-D-SAMPLE",
      milestoneId: "m-1",
      reason: "Item not as described",
      openedAt: ago(2 * DAY).slice(0, 10),
      status: "open",
      evidence: [], // built by the AI when someone presses the button
    },
  };
  const e = (at: string, ev: Parameters<typeof addEvent>[1]) => addEvent(deal, { ...ev, at });
  e(ago(20 * DAY), { type: "deal_created", summary: "Agreement recorded from the client chat", proof: [`Agreement fingerprint ${short(sha256Text(deal.agreement))}`] });
  e(ago(19 * DAY), { type: "payment_held", milestoneId: "m-1", summary: 'Client paid $350.00 for "Wireframes for 8 screens" — held by PayPal', proof: ["PayPal authorization SAMPLE-AUTH-4"] });
  e(ago(11 * DAY), { type: "work_submitted", milestoneId: "m-1", summary: 'Work delivered for "Wireframes for 8 screens": 1 item', proof: ["Link Figma file — 8 wireframe screens (sample)"] });
  e(ago(11 * DAY - 60_000), { type: "ai_checked", milestoneId: "m-1", summary: "AI check: claimed only" });
  e(ago(10 * DAY), { type: "released", milestoneId: "m-1", summary: "Client approved — $350.00 released to the freelancer", proof: ["PayPal capture SAMPLE-CAP-4 (COMPLETED)"] });
  e(ago(2 * DAY), { type: "dispute_opened", milestoneId: "m-1", summary: "Client opened a PayPal dispute: Item not as described", proof: ["PayPal dispute PP-D-SAMPLE"] });
  return deal;
}

// Fresh copies every time (dates are relative to now).
export function buildSampleDeals(): Deal[] {
  return [roomCleaning(), instagramTemplates(), blogPosts(), uiKitDispute()];
}
