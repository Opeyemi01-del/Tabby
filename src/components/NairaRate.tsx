"use client";
// Hands the naira exchange rate to every <Naira> on the page.
// The rate is read on the SERVER while the site runs (see layout.tsx), so
// changing it on the host takes effect without rebuilding the site.
import { createContext, useContext } from "react";

const RateContext = createContext<number | null>(null);

export function NairaRateProvider({ rate, children }: { rate: number | null; children: React.ReactNode }) {
  return <RateContext.Provider value={rate}>{children}</RateContext.Provider>;
}

export function useNairaRate(): number | null {
  return useContext(RateContext);
}
