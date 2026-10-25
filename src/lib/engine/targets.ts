import type { PrereqExpr } from "@/lib/curriculum/types";
import { creditsOf, knownCodes, type CurriculumIndex } from "./model";

/** Something the scheduler places in a semester: a specific course, or an open elective slot. */
export type PlanItem =
  | { kind: "course"; id: string; code: string; credits: number }
  | { kind: "slot"; id: string; groupId: string; credits: number; slotIndex: number };

export interface Targets {
  /** Everything still needed to graduate. */
  items: PlanItem[];
  /** Codes of specific courses still needed (required courses, chosen electives and their prerequisites). */
  courseCodes: Set<string>;
}

export function slotId(groupId: string, index: number): string {
  return `slot:${groupId}:${index}`;
}

export function isSlotId(id: string): boolean {
  return id.startsWith("slot:");
}

/**
 * Works out what is left to schedule.
 *
 * - Every course in an "all" group that isn't completed.
 * - For "choose" groups: electives the student picked, then open slots for the rest
 *   (so UniPath never picks an elective on the student's behalf unless another course needs it).
 * - The prerequisites of everything above, so the plan is always reachable.
 */
export function resolveTargets(
  index: CurriculumIndex,
  completedInput: Iterable<string>,
  electiveChoices: Record<string, string[]> = {},
): Targets {
  const completed = knownCodes(index, completedInput);
  const concrete = new Set<string>();
  const queue: string[] = [];

  const add = (code: string) => {
    if (!index.byCode.has(code) || completed.has(code) || concrete.has(code)) return;
    concrete.add(code);
    queue.push(code);
  };

  /** Courses that would have to be added to satisfy a rule. For "any", the cheapest alternative wins. */
  const extraNeeded = (expr: PrereqExpr | null, seen: ReadonlySet<string> = new Set()): string[] => {
    if (!expr) return [];
    switch (expr.kind) {
      case "course":
        return !index.byCode.has(expr.code) ||
          completed.has(expr.code) ||
          concrete.has(expr.code) ||
          seen.has(expr.code)
          ? []
          : [
              expr.code,
              ...extraNeeded(index.byCode.get(expr.code)!.prerequisite, new Set(seen).add(expr.code)),
            ];
      case "all":
        return [...new Set(expr.items.flatMap((item) => extraNeeded(item, seen)))];
      case "any": {
        const options = expr.items.map((item) => [...new Set(extraNeeded(item, seen))]);
        options.sort((a, b) => creditsOf(index, a) - creditsOf(index, b) || a.length - b.length);
        return options[0] ?? [];
      }
      default:
        return [];
    }
  };

  const closeOver = () => {
    while (queue.length) {
      const code = queue.shift()!;
      for (const need of extraNeeded(index.byCode.get(code)!.prerequisite)) add(need);
    }
  };

  const groups = index.curriculum.groups;
  for (const g of groups) if (g.rule === "all") g.courses.forEach(add);
  closeOver();

  const chooseGroups = groups.filter((g) => g.rule === "choose");
  const groupCredits = (codes: string[]) =>
    creditsOf(
      index,
      codes.filter((c) => completed.has(c) || concrete.has(c)),
    );

  // Student-chosen electives, in the order they chose them, until the requirement is covered.
  for (const g of chooseGroups) {
    for (const code of electiveChoices[g.id] ?? []) {
      if (groupCredits(g.courses) >= g.minCredits) break;
      if (g.courses.includes(code)) add(code);
      closeOver();
    }
  }

  // If a group can't be filled by open slots (not enough options whose prerequisites will be met),
  // commit to the cheapest options and plan their prerequisites.
  const openOptions = (g: (typeof groups)[number]) =>
    g.courses.filter((c) => !completed.has(c) && !concrete.has(c));
  const slotPlan = (g: (typeof groups)[number]) => {
    const remaining = g.minCredits - groupCredits(g.courses);
    if (remaining <= 0) return { count: 0, credits: 0 };
    const credits = mostCommon(openOptions(g).map((c) => index.byCode.get(c)!.credits)) ?? 3;
    return { count: Math.ceil(remaining / credits), credits };
  };

  let changed = true;
  while (changed) {
    changed = false;
    for (const g of chooseGroups) {
      const { count } = slotPlan(g);
      if (count === 0) continue;
      const open = openOptions(g);
      const ready = open.filter((c) => extraNeeded(index.byCode.get(c)!.prerequisite).length === 0);
      if (ready.length >= count) continue;
      const candidates = open.filter((c) => !ready.includes(c));
      if (candidates.length === 0) continue;
      candidates.sort(
        (a, b) =>
          creditsOf(index, extraNeeded(index.byCode.get(a)!.prerequisite)) -
          creditsOf(index, extraNeeded(index.byCode.get(b)!.prerequisite)),
      );
      add(candidates[0]);
      closeOver();
      changed = true;
    }
  }

  const items: PlanItem[] = [...concrete].map((code) => ({
    kind: "course",
    id: code,
    code,
    credits: index.byCode.get(code)!.credits,
  }));
  for (const g of chooseGroups) {
    const { count, credits } = slotPlan(g);
    for (let i = 0; i < count; i++) {
      items.push({ kind: "slot", id: slotId(g.id, i), groupId: g.id, credits, slotIndex: i });
    }
  }
  return { items, courseCodes: concrete };
}

function mostCommon(values: number[]): number | undefined {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: number | undefined;
  for (const [value, n] of counts) {
    if (best === undefined || n > counts.get(best)! || (n === counts.get(best)! && value < best)) best = value;
  }
  return best;
}
