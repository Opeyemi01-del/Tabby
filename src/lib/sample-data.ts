// SAMPLE DATA — fake deals so the screens have something to show.
// Edit names, amounts or statuses freely and watch the pages change.
// In step 2 this file gets replaced by a real database + PayPal.
// (All people and companies here are made up.)
import type { Deal } from "./types";

export const sampleDeals: Deal[] = [
  {
    id: "d-1001",
    title: "Logo & brand kit",
    clientName: "Sarah Mensah",
    clientEmail: "sarah@example.com",
    currency: "USD",
    createdAt: "2026-09-20",
    agreement:
      "Sarah: Can you design a logo + brand kit for my bakery? Budget is $450.\n" +
      "You: Sure. 50% upfront, 50% when I deliver the final files.\n" +
      "Sarah: Deal. I need 3 logo concepts, a color palette and the files in PNG and SVG.",
    milestones: [
      {
        id: "m-1",
        title: "Deposit — 3 logo concepts",
        amount: 225,
        dueDate: "2026-09-27",
        status: "released",
      },
      {
        id: "m-2",
        title: "Final logo files + color palette",
        amount: 225,
        dueDate: "2026-10-10",
        status: "funds_held",
      },
    ],
  },
  {
    id: "d-1002",
    title: "Landing page build",
    clientName: "Brightpath Studio",
    clientEmail: "hello@brightpath.example.com",
    currency: "USD",
    createdAt: "2026-09-15",
    agreement:
      "Brightpath: We need a one-page site for our launch. $1,000 total.\n" +
      "You: $400 for the design, $600 for building it. Mobile friendly, contact form included.\n" +
      "Brightpath: Perfect, go ahead.",
    milestones: [
      {
        id: "m-1",
        title: "Page design (Figma)",
        amount: 400,
        dueDate: "2026-09-22",
        status: "released",
      },
      {
        id: "m-2",
        title: "Built & deployed page",
        amount: 600,
        dueDate: "2026-10-05",
        status: "work_submitted",
        deliveryNote:
          "Live at brightpath-launch.example.com. Mobile layout tested; contact form sends to hello@brightpath.example.com.",
        aiCheck: {
          verdict: "claimed_only",
          summary:
            "The note says the site is live with a mobile layout and contact form, but no files or reachable links were provided to confirm it.",
        },
      },
    ],
  },
  {
    id: "d-1003",
    title: "Blog articles (5 posts)",
    clientName: "Amaka Eze",
    clientEmail: "amaka@example.com",
    currency: "USD",
    createdAt: "2026-09-30",
    agreement:
      "Amaka: I need 5 blog posts about personal finance, ~1,000 words each. $300?\n" +
      "You: Works for me. Delivery in 2 weeks, paid in full upfront and held until delivery.",
    milestones: [
      {
        id: "m-1",
        title: "5 articles, ~1,000 words each",
        amount: 300,
        dueDate: "2026-10-14",
        status: "awaiting_payment",
      },
    ],
  },
  {
    id: "d-1004",
    title: "Mobile app UI kit",
    clientName: "Northwind Apps",
    clientEmail: "pm@northwind.example.com",
    currency: "USD",
    createdAt: "2026-09-05",
    agreement:
      "Northwind: We need wireframes for 8 screens, then a full UI kit. $1,000 total.\n" +
      "You: $350 for the 8 wireframes, $650 for the UI kit.\n" +
      "Northwind: Approved. Wireframes by Sept 15 please.",
    milestones: [
      {
        id: "m-1",
        title: "Wireframes for 8 screens",
        amount: 350,
        dueDate: "2026-09-15",
        status: "disputed",
        deliveryNote: "Delivered 8 wireframes as a Figma link on Sept 14.",
        aiCheck: {
          verdict: "verified",
          summary: "8 wireframes delivered on Sept 14, one day before the agreed date.",
        },
      },
      {
        id: "m-2",
        title: "Full UI kit",
        amount: 650,
        dueDate: "2026-10-12",
        status: "awaiting_payment",
      },
    ],
    dispute: {
      id: "PP-D-5531",
      milestoneId: "m-1",
      reason: "Item not as described",
      openedAt: "2026-09-28",
      status: "open",
      evidence: [
        {
          title: "Agreed scope",
          detail: 'Chat on Sept 5: client approved "wireframes for 8 screens" for $350, due Sept 15.',
        },
        {
          title: "Proof of delivery",
          detail: "Figma link with 8 wireframe screens shared on Sept 14 (1 day early).",
        },
        {
          title: "Client acknowledgement",
          detail: 'Client replied "looks good, start the UI kit" on Sept 16.',
        },
        {
          title: "Summary for PayPal",
          detail:
            "The work delivered matches the written agreement in quantity, format and date. We request the dispute be closed in the seller's favour.",
        },
      ],
    },
  },
];
