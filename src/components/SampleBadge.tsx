// "Sample" tag on the built-in example deals (see Deal.sample), so nobody
// mistakes them for real payments.
export default function SampleBadge() {
  return (
    <span
      title="A built-in example for looking around — no real PayPal payment behind it"
      className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 align-middle text-[11px] font-medium text-amber-800 ring-1 ring-amber-200"
    >
      Sample
    </span>
  );
}
