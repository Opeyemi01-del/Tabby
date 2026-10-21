"use client";
// Buttons under a dispute on the Disputes page:
//   no evidence yet  -> "Build evidence pack with AI"
//   evidence ready   -> "Submit evidence to PayPal"
//   already sent     -> a confirmation message
import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/client-api";
import type { Dispute } from "@/lib/types";

type Props = { dealId: string; dispute: Dispute; sample?: boolean };

export default function DisputeActions({ dealId, dispute, sample }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const hasEvidence = dispute.evidence.length > 0;
  const url = `/api/deals/${dealId}/dispute/evidence${hasEvidence ? "?submit=1" : ""}`;

  async function handleClick() {
    setBusy(true);
    setError("");
    try {
      await postJson(url);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  }

  if (dispute.status !== "open") {
    return (
      <p className="mt-4 text-sm font-medium text-brand-700">
        {sample
          ? "Evidence submitted ✓ (simulated — this sample dispute isn't a real PayPal case)"
          : "Evidence sent to PayPal ✓ — waiting for their decision."}
      </p>
    );
  }

  return (
    <div className="mt-4">
      <button
        onClick={handleClick}
        disabled={busy}
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {busy
          ? hasEvidence
            ? "Sending to PayPal…"
            : "AI is building your evidence…"
          : hasEvidence
            ? sample
              ? "Submit evidence (simulated)"
              : "Submit evidence to PayPal"
            : "Build evidence pack with AI"}
      </button>
      {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}
