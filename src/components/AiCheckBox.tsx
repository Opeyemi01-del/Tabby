// The AI's verdict + checklist. Used on the freelancer's deal page and the
// client's review page, so both sides see exactly the same result.
// Change the wording/colors of each verdict in `verdicts` below.
import type { AiCheck, Verdict } from "@/lib/types";

const verdicts: Record<Verdict, { title: string; box: string }> = {
  verified: { title: "Verified from the delivered files", box: "bg-brand-50 text-brand-900" },
  claimed_only: { title: "Claimed only — the AI couldn't inspect the work", box: "bg-slate-100 text-slate-800" },
  concerns: { title: "Needs attention", box: "bg-amber-50 text-amber-900" },
};

const marks = { yes: "✓", no: "✗", unclear: "?" };
const markColors = { yes: "text-brand-700", no: "text-red-700", unclear: "text-slate-500" };

export default function AiCheckBox({ check }: { check: AiCheck }) {
  // Older records may have a verdict we no longer use; show them neutrally.
  const v = verdicts[check.verdict] ?? verdicts.claimed_only;

  return (
    <div className={`mt-3 rounded-lg p-3 text-sm ${v.box}`}>
      <span className="font-semibold">AI check: {v.title}</span>
      <p className="mt-1">{check.summary}</p>

      {check.checklist && check.checklist.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {check.checklist.map((item) => (
            <li key={item.requirement} className="flex gap-2">
              <span className={`w-4 shrink-0 font-bold ${markColors[item.met]}`}>{marks[item.met]}</span>
              <span>
                <span className="font-medium">{item.requirement}</span>
                {item.note && <span className="opacity-80"> — {item.note}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
