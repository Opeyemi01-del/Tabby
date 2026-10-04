"use client";
// Keeps a page up to date: every few seconds it quietly reloads the data
// from the server (router.refresh), so e.g. "Awaiting payment" turns into
// "Funds held" without the user pressing reload. Anything typed into
// forms on the page is kept.
// Only runs while the tab is visible, and only when `active` is true
// (pages pass false when nothing is waiting, to save requests).
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AutoRefresh({ active = true, seconds = 10 }: { active?: boolean; seconds?: number }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(timer);
  }, [active, seconds, router]);

  return null; // nothing to show
}
