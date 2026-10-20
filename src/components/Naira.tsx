"use client";
// Small grey "≈ ₦90,000" next to a USD amount. Shows nothing if the
// exchange rate isn't set (NGN_PER_USD in .env.local).
import { formatNaira } from "@/lib/format";
import { useNairaRate } from "./NairaRate";

export default function Naira({ usd, className = "" }: { usd: number; className?: string }) {
  const text = formatNaira(usd, useNairaRate());
  return text ? <span className={`text-xs font-normal text-slate-500 ${className}`}>{text}</span> : null;
}
