"use client";

import { toast } from "sonner";
import { usePlanContext } from "@/components/app-shell/plan-context";
import { describePrereq, unmetParts } from "@/lib/curriculum/prereq";
import { courseName, isSlotId, prereqContext } from "@/lib/engine";
import { useAppStore } from "@/lib/state/store";
import { joinNames } from "@/lib/utils";

/** Renumbers elective slots so they match the ids the engine generates (slot:group:0, :1, …). */
function normalizeSlots(ids: string[]): string[] {
  const counters = new Map<string, number>();
  return ids.map((id) => {
    if (!isSlotId(id)) return id;
    const group = id.split(":")[1];
    const n = counters.get(group) ?? 0;
    counters.set(group, n + 1);
    return `slot:${group}:${n}`;
  });
}

export type AddCheck = { ok: true } | { ok: false; title: string; description: string };

/** Adding and removing courses in next semester's plan, with clear explanations when something isn't allowed. */
export function usePlanActions() {
  const plan = usePlanContext();
  const setNextSemester = useAppStore((s) => s.setNextSemester);
  const chooseElective = useAppStore((s) => s.chooseElective);
  const currentIds = plan.nextItems.map((s) => s.item.id);
  const currentCredits = plan.nextItems.reduce((sum, s) => sum + s.item.credits, 0);
  const maxCredits = plan.settings.maxCredits;

  const canAdd = (code: string): AddCheck => {
    const course = plan.index.byCode.get(code);
    const state = plan.states.get(code);
    if (!course || !state) return { ok: false, title: "Course not found", description: "This course isn't in your plan." };
    const name = course.title;
    if (state.status === "completed") return { ok: false, title: `${name} is already completed`, description: "Nothing to plan here." };
    if (state.status === "inprogress") {
      return { ok: false, title: `You're taking ${name} this semester`, description: "UniPath already counts it as done for next semester." };
    }
    if (currentIds.includes(code)) return { ok: false, title: `${name} is already planned`, description: "It's in your plan for next semester." };
    if (!state.prereqMet) {
      const ctx = prereqContext(plan.index, plan.assumedDone);
      const missing = joinNames(
        unmetParts(course.prerequisite, ctx).map((part) =>
          part.kind === "credits"
            ? `${part.min} completed credit hours (you'll have ${plan.assumedEarnedCredits})`
            : describePrereq(part, (c) => courseName(plan.index, c)),
        ),
      );
      return { ok: false, title: `You can't plan ${name} yet`, description: `Complete first: ${missing}.` };
    }
    if (state.notNeeded) {
      const group = plan.index.groupById.get(course.groupId)!;
      return {
        ok: false,
        title: `Your ${group.title} is already complete`,
        description: `${name} wouldn't count toward your degree.`,
      };
    }
    const group = plan.index.groupById.get(course.groupId)!;
    const replacesSlot = group.rule === "choose" && currentIds.some((id) => id.startsWith(`slot:${group.id}:`));
    const after = currentCredits + course.credits - (replacesSlot ? course.credits : 0);
    if (after > maxCredits) {
      return {
        ok: false,
        title: `That would be ${after} credit hours`,
        description: `Your limit is ${maxCredits}. Remove a course or raise your credit limit first.`,
      };
    }
    return { ok: true };
  };

  const add = (code: string) => {
    const check = canAdd(code);
    if (!check.ok) {
      toast.error(check.title, { description: check.description });
      return false;
    }
    const course = plan.index.byCode.get(code)!;
    const group = plan.index.groupById.get(course.groupId)!;
    let ids = [...currentIds];
    if (group.rule === "choose") {
      chooseElective(group.id, code);
      const slot = ids.find((id) => id.startsWith(`slot:${group.id}:`));
      ids = slot ? ids.map((id) => (id === slot ? code : id)) : [...ids, code];
    } else {
      ids.push(code);
    }
    setNextSemester(normalizeSlots(ids));
    toast(`${course.title} added to next semester`, {
      action: { label: "Undo", onClick: () => setNextSemester(currentIds) },
    });
    return true;
  };

  const remove = (id: string) => {
    const name = isSlotId(id)
      ? plan.index.groupById.get(id.split(":")[1])?.title ?? "Elective"
      : courseName(plan.index, id);
    setNextSemester(normalizeSlots(currentIds.filter((x) => x !== id)));
    toast(`${name} removed from next semester`, {
      action: { label: "Undo", onClick: () => setNextSemester(currentIds) },
    });
  };

  /** Turn an open elective slot into a specific course. */
  const pickForSlot = (slotIdValue: string, code: string) => {
    const groupId = slotIdValue.split(":")[1];
    chooseElective(groupId, code);
    setNextSemester(normalizeSlots(currentIds.map((id) => (id === slotIdValue ? code : id))));
    toast(`${courseName(plan.index, code)} chosen`, {
      description: "Saved as your elective choice.",
    });
  };

  const resetToRecommended = () => {
    const previous = plan.record.nextSemester;
    setNextSemester(null);
    toast("Back to the recommended plan", {
      action: { label: "Undo", onClick: () => setNextSemester(previous) },
    });
  };

  return { canAdd, add, remove, pickForSlot, resetToRecommended, currentIds, currentCredits, maxCredits };
}
