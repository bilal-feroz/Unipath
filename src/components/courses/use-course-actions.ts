"use client";

import { toast } from "sonner";
import { usePlanContext } from "@/components/app-shell/plan-context";
import { unlockedBy } from "@/lib/engine";
import { useAppStore } from "@/lib/state/store";
import { joinNames } from "@/lib/utils";

/** Marking courses done, with immediate feedback and an Undo action. */
export function useCourseActions() {
  const plan = usePlanContext();
  const toggleCompleted = useAppStore((s) => s.toggleCompleted);

  const toggle = (code: string) => {
    const course = plan.index.byCode.get(code);
    if (!course) return;
    const unlocks = plan.completed.has(code) ? [] : unlockedBy(plan.index, plan.completed, code);
    const nowDone = toggleCompleted(code);
    const names = unlocks.slice(0, 3).map((c) => plan.index.byCode.get(c)?.title ?? c);
    toast(nowDone ? `${course.title} marked as completed` : `${course.title} moved back to not completed`, {
      description: nowDone
        ? unlocks.length > 0
          ? `Now available: ${joinNames(names)}${unlocks.length > 3 ? ` and ${unlocks.length - 3} more` : ""}.`
          : `+${course.credits} credit hours toward your degree.`
        : "Your progress and plan have been updated.",
      action: { label: "Undo", onClick: () => toggleCompleted(code) },
    });
  };

  return { toggle };
}
