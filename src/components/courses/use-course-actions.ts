"use client";

import { toast } from "sonner";
import { usePlanContext } from "@/components/app-shell/plan-context";
import { unlockedBy } from "@/lib/engine";
import { useAppStore } from "@/lib/state/store";
import { joinNames } from "@/lib/utils";

/** Marking courses done or "taking now", with immediate feedback and an Undo action. */
export function useCourseActions() {
  const plan = usePlanContext();
  const toggleCompleted = useAppStore((s) => s.toggleCompleted);
  const toggleInProgress = useAppStore((s) => s.toggleInProgress);

  const unlockText = (code: string) => {
    const unlocks = plan.assumedDone.has(code) ? [] : unlockedBy(plan.index, plan.assumedDone, code);
    const names = unlocks.slice(0, 3).map((c) => plan.index.byCode.get(c)?.title ?? c);
    return unlocks.length > 0
      ? `Now available next semester: ${joinNames(names)}${unlocks.length > 3 ? ` and ${unlocks.length - 3} more` : ""}.`
      : null;
  };

  /** Puts a course back exactly how it was (completed, taking now, or neither). */
  const restore = (code: string, wasCompleted: boolean, wasInProgress: boolean) => {
    const r = useAppStore.getState();
    const profile = r.activeProfile === "demo" ? r.demo : r.personal;
    const record = profile?.progress[profile.curriculumId];
    const isCompleted = !!record?.completed.includes(code);
    const isInProgress = !!record?.inProgress.includes(code);
    if (wasInProgress && !isInProgress) toggleInProgress(code);
    else if (wasCompleted && !isCompleted) toggleCompleted(code);
    else if (!wasCompleted && isCompleted) toggleCompleted(code);
    else if (!wasInProgress && isInProgress) toggleInProgress(code);
  };

  const toggle = (code: string) => {
    const course = plan.index.byCode.get(code);
    if (!course) return;
    const wasCompleted = plan.completed.has(code);
    const wasInProgress = plan.inProgress.has(code);
    const unlocks = wasCompleted || wasInProgress ? null : unlockText(code);
    const nowDone = toggleCompleted(code);
    toast(nowDone ? `${course.title} marked as completed` : `${course.title} moved back to not completed`, {
      description: nowDone
        ? (unlocks ?? `+${course.credits} credit hours toward your degree.`)
        : "Your progress and plan have been updated.",
      action: { label: "Undo", onClick: () => restore(code, wasCompleted, wasInProgress) },
    });
  };

  const toggleNow = (code: string) => {
    const course = plan.index.byCode.get(code);
    if (!course) return;
    const wasCompleted = plan.completed.has(code);
    const wasInProgress = plan.inProgress.has(code);
    const unlocks = wasInProgress || wasCompleted ? null : unlockText(code);
    const nowTaking = toggleInProgress(code);
    toast(nowTaking ? `Taking ${course.title} this semester` : `${course.title} removed from this semester`, {
      description: nowTaking
        ? (unlocks ?? "UniPath will plan next semester as if you pass it.")
        : "Your plan has been updated.",
      action: { label: "Undo", onClick: () => restore(code, wasCompleted, wasInProgress) },
    });
  };

  return { toggle, toggleNow };
}
