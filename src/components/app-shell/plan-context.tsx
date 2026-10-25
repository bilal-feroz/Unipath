"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { PlanView } from "@/lib/plan";

const PlanContext = createContext<PlanView | null>(null);

export function PlanProvider({ plan, children }: { plan: PlanView; children: ReactNode }) {
  return <PlanContext.Provider value={plan}>{children}</PlanContext.Provider>;
}

/** The current plan. Only available inside the app shell, which guarantees a major is selected. */
export function usePlanContext(): PlanView {
  const plan = useContext(PlanContext);
  if (!plan) throw new Error("usePlanContext must be used inside the app shell");
  return plan;
}
