"use client";
// "Cancel & refund" button, used by both sides:
//   who="client"     -> client gets their money back after a missed deadline
//   who="freelancer" -> freelancer gives up the milestone
// Asks for confirmation first, because it can't be undone.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/client-api";
import { formatMoney } from "@/lib/format";

type Props = {
  dealId: string;
  milestoneId: string;
  amount: number;
  who: "client" | "freelancer";
  linkKey?: string; // client only: key from the private review link
};

export default function CancelButton({ dealId, milestoneId, amount, who, linkKey }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const question =
    who === "client"
      ? `Cancel this milestone and get your ${formatMoney(amount)} back? The freelancer won't be paid for it.`
      : `Cancel this milestone and release the client's ${formatMoney(amount)}? You won't be paid for it.`;

  async function handleCancel() {
    if (!window.confirm(question)) return;
    setBusy(true);
    setError("");
    try {
      const path = who === "client" ? "client-cancel" : "cancel";
      await postJson(`/api/deals/${dealId}/milestones/${milestoneId}/${path}`, { key: linkKey });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  }

  return (
    <div className="mt-3">
      <button
        onClick={handleCancel}
        disabled={busy}
        className={
          who === "client"
            ? "rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            : "text-sm font-medium text-red-700 underline disabled:opacity-50"
        }
      >
        {busy
          ? "Cancelling with PayPal…"
          : who === "client"
            ? `Cancel & get my ${formatMoney(amount)} back`
            : "Can't finish? Cancel & refund the client"}
      </button>
      {error && <p className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}
