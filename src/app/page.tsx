// LANDING PAGE ("/") — the first thing visitors and judges see.
// Edit the text in `steps` and `features` below to change those sections.
import Link from "next/link";
import Navbar from "@/components/Navbar";

const steps = [
  { title: "Paste the chat", text: "Drop in your client conversation. AI turns it into a deal with milestones." },
  { title: "Client pays, PayPal holds", text: "Your client pays up front. The money is reserved, not sent, until work is delivered." },
  { title: "AI checks the delivery", text: "Submit your work. AI compares it with what you agreed before money is released." },
  { title: "Get paid, stay protected", text: "Funds are released to you. If a client disputes, AI builds your evidence pack." },
];

const features = [
  { title: "No more unpaid work", text: "You only start once the client's money is held by PayPal." },
  { title: "Fair for clients too", text: "Clients only pay out when the work matches the agreement." },
  { title: "AI dispute defense", text: "Chargeback? Tabby assembles the chat, delivery proof and a summary for PayPal." },
];

// "Try it" guide for visitors and judges. The sandbox buyer login comes
// from DEMO_BUYER_EMAIL / DEMO_BUYER_PASSWORD (set on the host); if they're
// missing, that line is left out. Sandbox = PayPal's test mode, fake money.
const tryLinks = [
  { href: "/deals/d-sample-pipe", label: "On-site job paid from abroad", note: "materials + work, completion codes, before/after photos" },
  { href: "/certificate/d-sample-pipe/m-2", label: "Its delivery certificate", note: "fingerprinted proof, shareable" },
  { href: "/review/d-sample-insta", label: "What the paying client sees", note: "AI check of real files, approve or ask for fixes" },
  { href: "/disputes", label: "A dispute", note: "AI builds the evidence pack for PayPal" },
];

export default function Home() {
  const buyerEmail = process.env.DEMO_BUYER_EMAIL;
  const buyerPassword = process.env.DEMO_BUYER_PASSWORD;

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-5xl px-4">
        {/* Hero: headline + buttons */}
        <section className="py-20 text-center">
          <p className="mb-3 text-sm font-medium text-brand-700">For freelancers who are tired of chasing payments</p>
          <h1 className="mx-auto max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
            Get paid for every milestone. No chasing. No chargebacks.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-slate-600">
            Tabby holds your client&apos;s payment with PayPal and uses AI to confirm the work and defend you in
            disputes.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/deals/new" className="rounded-lg bg-brand-600 px-5 py-3 font-medium text-white hover:bg-brand-700">
              Start a deal
            </Link>
            <Link href="/dashboard" className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-medium hover:bg-slate-50">
              View dashboard
            </Link>
          </div>
        </section>

        {/* Try it: sample deals to look at, then the real flow */}
        <section id="try" className="mb-16 rounded-2xl border border-brand-100 bg-white p-6 sm:p-8">
          <h2 className="text-2xl font-semibold">Try it</h2>
          <p className="mt-1 text-sm text-slate-600">
            Payments run in the PayPal sandbox (PayPal&apos;s test mode) — no real money moves.
          </p>

          <div className="mt-6 grid gap-8 md:grid-cols-2">
            <div>
              <h3 className="font-semibold">1. Look around (no sign-in)</h3>
              <p className="mt-1 text-sm text-slate-600">Sample deals, frozen at interesting moments:</p>
              <ul className="mt-3 flex flex-col gap-2 text-sm">
                {tryLinks.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="font-medium text-brand-700 underline">
                      {l.label}
                    </Link>
                    <span className="text-slate-500"> — {l.note}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-semibold">2. Run a real deal (about 5 minutes)</h3>
              <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5 text-sm text-slate-700">
                <li>
                  <Link href="/deals/new" className="font-medium text-brand-700 underline">
                    New deal
                  </Link>{" "}
                  → pick a sample chat → let the AI draft it → create the deal.
                </li>
                <li>Open the payment link and pay with the sandbox buyer account below. PayPal holds the money.</li>
                <li>Back on the deal, deliver the work (a file, or before/after photos for an on-site job).</li>
                <li>On the client&apos;s review page, read the AI check and approve — PayPal releases the payment.</li>
              </ol>
              {buyerEmail && buyerPassword && (
                <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm">
                  <p className="font-medium">Sandbox buyer login (test money only)</p>
                  <p className="mt-1 font-mono text-xs">
                    Email: {buyerEmail}
                    <br />
                    Password: {buyerPassword}
                  </p>
                </div>
              )}
              <p className="mt-3 text-xs text-slate-500">
                This demo runs on a free server: the first visit can take up to a minute, and deals you create may be
                cleared when it restarts. The sample deals always come back.
              </p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="pb-16">
          <h2 className="mb-6 text-center text-2xl font-semibold">How it works</h2>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, i) => (
              <li key={step.title} className="rounded-xl border border-slate-200 bg-white p-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                  {i + 1}
                </span>
                <h3 className="mt-3 font-semibold">{step.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Why Tabby */}
        <section className="grid gap-4 pb-20 sm:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-xl bg-brand-900 p-6 text-white">
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-brand-100">{f.text}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="mt-auto border-t border-slate-200 py-6 text-center text-sm text-slate-500">
        Built for the PayPal AI Hackathon · Payments run in the PayPal sandbox
      </footer>
    </>
  );
}
