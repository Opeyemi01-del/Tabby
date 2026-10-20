"use client";
// Takes up to 3 photos with the phone's camera (one tap = one photo),
// shows small previews, and lets the artisan remove a bad one.
// On a computer the same button opens a normal file picker.
import { useEffect, useRef, useState } from "react";
import { shrinkPhoto } from "@/lib/photos";

export type Shot = { file: File; takenAt: number; preview: string };

type Props = {
  label: string; // e.g. "Take before photos"
  shots: Shot[];
  onChange: (shots: Shot[]) => void;
  max?: number;
};

// Adds the photos to a form: "photos" + "takenAt" in the same order.
export function appendShots(form: FormData, shots: Shot[]) {
  shots.forEach((s) => {
    form.append("photos", s.file);
    form.append("takenAt", String(s.takenAt));
  });
}

export default function PhotoCapture({ label, shots, onChange, max = 3 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preparing, setPreparing] = useState(false);

  // Free the preview images when this leaves the page.
  const latest = useRef(shots);
  useEffect(() => {
    latest.current = shots;
  });
  useEffect(() => () => latest.current.forEach((s) => URL.revokeObjectURL(s.preview)), []);

  async function handlePick(list: FileList | null) {
    const picked = Array.from(list ?? []).slice(0, max - shots.length);
    if (picked.length === 0) return;
    setPreparing(true);
    const added = await Promise.all(
      picked.map(async (original) => {
        const file = await shrinkPhoto(original);
        return { file, takenAt: original.lastModified, preview: URL.createObjectURL(file) };
      }),
    );
    onChange([...shots, ...added]);
    setPreparing(false);
    if (inputRef.current) inputRef.current.value = ""; // allow the same photo again after removing it
  }

  function remove(i: number) {
    URL.revokeObjectURL(shots[i].preview);
    onChange(shots.filter((_, j) => j !== i));
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        {shots.map((s, i) => (
          <div key={s.preview} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element -- local preview, not a page image */}
            <img src={s.preview} alt={`Photo ${i + 1}`} className="h-20 w-20 rounded-lg object-cover ring-1 ring-slate-200" />
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label={`Remove photo ${i + 1}`}
              className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-slate-900 text-xs text-white"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {shots.length < max && (
        <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50">
          📷 {preparing ? "Preparing photo…" : shots.length ? "Add another photo" : label}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => handlePick(e.target.files)}
            className="sr-only"
          />
        </label>
      )}
      <p className="mt-1 text-xs text-slate-500">
        {shots.length} of {max} photos · use the camera now, not old photos — the time each photo was taken is recorded
      </p>
    </div>
  );
}
