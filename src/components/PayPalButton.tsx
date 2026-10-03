"use client";
// The real PayPal checkout button on the client's payment page.
// Loads PayPal's official script from paypal.com, then:
//   createOrder -> our server creates a "hold" order (/api/paypal/orders)
//   onApprove   -> our server reserves the money (/api/paypal/orders/{id}/authorize)
// The Client ID is public (it's visible in the script URL); the SECRET
// never leaves the server.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/client-api";

// Just the parts of PayPal's script we use.
type PayPalNamespace = {
  Buttons: (options: {
    style?: Record<string, string>;
    createOrder: () => Promise<string>;
    onApprove: (data: { orderID: string }) => Promise<void>;
    onCancel?: () => void;
    onError?: (err: unknown) => void;
  }) => { render: (container: HTMLElement) => Promise<void> };
};

declare global {
  interface Window {
    paypal?: PayPalNamespace;
  }
}

// Load PayPal's script once, even if the button is shown again.
let sdkPromise: Promise<PayPalNamespace> | undefined;
function loadPayPalSdk(clientId: string): Promise<PayPalNamespace> {
  sdkPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    // intent=authorize: the payment is HELD, not taken straight away.
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=authorize`;
    script.onload = () => (window.paypal ? resolve(window.paypal) : reject(new Error("PayPal failed to load")));
    script.onerror = () => {
      sdkPromise = undefined; // allow a retry on the next visit
      reject(new Error("Couldn't load PayPal — check your internet connection and refresh"));
    };
    document.body.appendChild(script);
  });
  return sdkPromise;
}

export default function PayPalButton({ dealId, clientId }: { dealId: string; clientId: string }) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ kind: "error" | "success" | "info"; text: string } | null>(null);
  const [reviewLink, setReviewLink] = useState("");

  useEffect(() => {
    let cancelled = false;

    loadPayPalSdk(clientId)
      .then((paypal) => {
        const container = containerRef.current;
        if (cancelled || !container) return;
        container.innerHTML = ""; // avoid showing the button twice

        return paypal
          .Buttons({
            style: { layout: "vertical", shape: "pill", label: "pay" },

            // 1. Client clicked: ask our server for a PayPal "hold" order.
            createOrder: async () => {
              setMessage(null);
              try {
                const { orderId } = await postJson<{ orderId: string }>("/api/paypal/orders", { dealId });
                return orderId;
              } catch (err) {
                setMessage({ kind: "error", text: (err as Error).message });
                throw err;
              }
            },

            // 2. Client approved in the popup: reserve the money.
            //    The first payment also returns a private review link.
            onApprove: async ({ orderID }) => {
              try {
                const { reviewUrl } = await postJson<{ reviewUrl?: string }>(
                  `/api/paypal/orders/${encodeURIComponent(orderID)}/authorize`,
                );
                setMessage({
                  kind: "success",
                  text: "Payment held by PayPal ✓ It's only released when you approve the delivered work.",
                });
                if (reviewUrl) setReviewLink(window.location.origin + reviewUrl);
                router.refresh();
              } catch (err) {
                setMessage({ kind: "error", text: (err as Error).message });
              }
            },

            onCancel: () => setMessage({ kind: "info", text: "Payment cancelled — you haven't been charged." }),
            onError: () =>
              setMessage((current) =>
                current?.kind === "error" ? current : { kind: "error", text: "PayPal ran into a problem. Please try again." },
              ),
          })
          .render(container);
      })
      .catch((err: Error) => {
        if (!cancelled) setMessage({ kind: "error", text: err.message });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [clientId, dealId, router]);

  const messageStyles = {
    error: "bg-red-50 text-red-700",
    success: "bg-brand-50 text-brand-900",
    info: "bg-slate-100 text-slate-700",
  };

  return (
    <div className="mt-5">
      {loading && <p className="text-center text-sm text-slate-500">Loading PayPal…</p>}
      <div ref={containerRef} />
      {message && <p className={`mt-3 rounded-lg p-3 text-sm ${messageStyles[message.kind]}`}>{message.text}</p>}

      {/* Shown once, right after the first payment. Only the payer sees it. */}
      {reviewLink && (
        <div className="mt-3 rounded-lg border border-brand-100 bg-white p-3 text-sm">
          <p className="font-semibold">Save your private review link</p>
          <p className="mt-1 text-slate-600">
            You&apos;ll use it to approve the work before any money is released. Don&apos;t share it — anyone with
            this link can approve payments.
          </p>
          <input
            readOnly
            value={reviewLink}
            onFocus={(e) => e.target.select()}
            className="mt-2 w-full rounded border border-slate-300 bg-slate-50 px-2 py-1 font-mono text-xs"
          />
          <button
            onClick={() => navigator.clipboard?.writeText(reviewLink)}
            className="mt-2 text-sm font-medium text-brand-700 underline"
          >
            Copy link
          </button>
        </div>
      )}
    </div>
  );
}
