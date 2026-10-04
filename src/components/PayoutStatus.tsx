"use client";
// Shows whether a paid milestone's money has reached the freelancer's own
// PayPal (PayPal Payouts), with a button to check again or retry.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/client-api";
import { formatMoney } from "@/lib/format";
import type { Milestone } from "@/lib/types";

type Props = { dealId: string; milestone: Milestone; hasPayoutEmail: boolean };

export default function PayoutStatus({ dealId, milestone, hasPayoutEmail }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const payout = milestone.payout;

  async function checkOrRetry() {
    setBusy(true);
    setError("");
    try {
      await postJson(`/api/deals/${dealId}/milestones/${milestone.id}/payout`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  }

  if (!hasPayoutEmail) {
    return (
      <p className="mt-2 text-xs text-slate-500">
        This deal has no PayPal payout email, so the money stays in Tabby&apos;s PayPal account.
      </p>
    );
  }

  const button = (label: string) => (
    <button onClick={checkOrRetry} disabled={busy} className="ml-2 font-medium underline disabled:opacity-50">
      {busy ? "Checking…" : label}
    </button>
  );

  return (
    <div className="mt-2 text-sm">
      {payout?.status === "sent" && (
        <p className="text-emerald-700">→ {formatMoney(payout.amount)} sent to your PayPal account ✓</p>
      )}
      {payout?.status === "pending" && (
        <p className="text-slate-600">
          → {formatMoney(payout.amount)} on its way to your PayPal account…{button("Check")}
        </p>
      )}
      {(payout?.status === "failed" || !payout) && (
        <p className="rounded-lg bg-red-50 p-2 text-red-700">
          Payout to your PayPal {payout ? `failed: ${payout.error}` : "hasn't been sent yet"}.{button("Try again")}
        </p>
      )}
      {payout && payout.amount < milestone.amount && (
        <p className="mt-1 text-xs text-slate-500">
          {formatMoney(milestone.amount)} paid by the client, minus PayPal&apos;s fee of{" "}
          {formatMoney(milestone.amount - payout.amount)}.
        </p>
      )}
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
