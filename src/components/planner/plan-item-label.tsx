"use client";

import { usePlanContext } from "@/components/app-shell/plan-context";
import type { PlanItem } from "@/lib/engine";

/** Display name and code for a plan item (a course or an open elective slot). */
export function usePlanItemLabel() {
  const plan = usePlanContext();
  return (item: PlanItem) => {
    if (item.kind === "course") {
      return { title: plan.index.byCode.get(item.code)?.title ?? item.code, code: item.code, isSlot: false };
    }
    const group = plan.index.groupById.get(item.groupId);
    return { title: `${group?.title ?? "Elective"} (your choice)`, code: "ELECTIVE", isSlot: true };
  };
}
