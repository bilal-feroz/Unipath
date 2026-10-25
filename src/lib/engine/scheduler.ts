import { creditThreshold, isSatisfied, type PrereqContext } from "@/lib/curriculum/prereq";
import { courseName, creditsOf, knownCodes, type CurriculumIndex } from "./model";
import { resolveTargets, type PlanItem } from "./targets";
import { nextTerm, termLabel, type Term } from "./terms";

export interface PlanSettings {
  /** Maximum credit hours in a fall or spring semester. */
  maxCredits: number;
  includeSummer: boolean;
  summerMaxCredits: number;
  /** The first semester to plan. */
  startTerm: Term;
}

export const DEFAULT_SETTINGS: Omit<PlanSettings, "startTerm"> = {
  maxCredits: 18,
  includeSummer: false,
  summerMaxCredits: 6,
};

export const CREDIT_LIMITS = { min: 3, max: 21, summerMax: 12 } as const;

export interface RoadmapInput {
  index: CurriculumIndex;
  completed: Iterable<string>;
  electiveChoices?: Record<string, string[]>;
  settings: PlanSettings;
  /** The student's own plan for the first semester (item ids). Null means "use the recommendation". */
  firstSemester?: string[] | null;
  /** Item id -> earliest semester index (0 = first planned semester) it may be placed in. */
  notBefore?: Record<string, number>;
  /** Course codes that are failed on the first attempt and must be retaken. */
  failOnce?: string[];
}

export interface ScheduledItem {
  item: PlanItem;
  reasons: string[];
  /** This attempt is failed (only in "what if I need to retake" scenarios). */
  failed?: boolean;
  /** This is a second attempt. */
  retake?: boolean;
}

export interface PlannedSemester {
  /** Position in the term sequence (0 = first planned semester), counting skipped summers. */
  index: number;
  term: Term;
  label: string;
  isSummer: boolean;
  items: ScheduledItem[];
  credits: number;
  /** Credits counted toward the degree after this semester. */
  countedAfter: number;
  remainingAfter: number;
  milestones: string[];
}

export interface FirstSemesterIssue {
  id: string;
  message: string;
}

export interface Roadmap {
  semesters: PlannedSemester[];
  graduationTerm: Term | null;
  /** Number of semesters with courses (summers included when used). */
  semesterCount: number;
  summerCount: number;
  remainingCredits: number;
  /** Set when the remaining requirements cannot be scheduled. */
  blocked: { message: string; itemIds: string[] } | null;
  /** Items from the student's own first-semester plan that had to be dropped. */
  firstSemesterIssues: FirstSemesterIssue[];
  /** Fewest term steps any schedule could need under these settings (credit and chain limits). */
  lowerBound: number;
  /** True when this plan matches the lower bound, so no schedule can finish sooner under these settings. */
  provablyFastest: boolean;
  /** Term index (0-based) where each item is placed, for comparisons. Failed attempts are not counted. */
  placement: Map<string, number>;
}

const MAX_TERMS = 30;

interface Priority {
  height: number;
  downstream: number;
  directDependents: string[];
  recommended: number;
}

/** Builds the semester-by-semester plan to graduation. Deterministic for the same input. */
export function buildRoadmap(input: RoadmapInput): Roadmap {
  const { index, settings } = input;
  const notBefore = input.notBefore ?? {};
  const failOnce = new Set(input.failOnce ?? []);
  const completed = knownCodes(index, input.completed);
  const targets = resolveTargets(index, completed, input.electiveChoices);
  const priority = computePriorities(index, targets.items, targets.courseCodes);

  const remaining = new Map(targets.items.map((item) => [item.id, item]));
  const done = new Set(completed);
  let earned = creditsOf(index, done);
  let counted = index.curriculum.totalCredits - remainingCreditsOf(index, completed);
  const attempts = new Map<string, number>();
  const consumed = new Map<string, Set<string>>();

  const semesters: PlannedSemester[] = [];
  const placement = new Map<string, number>();
  let blocked: Roadmap["blocked"] = null;
  const firstSemesterIssues: FirstSemesterIssue[] = [];
  let term = settings.startTerm;
  let lastUsedIndex = -1;

  const sortedIds = [...remaining.keys()].sort((a, b) => comparePriority(priority.get(a)!, priority.get(b)!, a, b));

  for (let ti = 0; remaining.size > 0 && ti < MAX_TERMS; ti++) {
    const isSummer = term.season === "summer";
    const cap = isSummer ? settings.summerMaxCredits : settings.maxCredits;
    const ctxBase = { completed: done, earnedCredits: earned };
    const termConsumed = new Map<string, Set<string>>();

    const slotOption = (item: Extract<PlanItem, { kind: "slot" }>, ctx: PrereqContext): string | null => {
      const group = index.groupById.get(item.groupId)!;
      for (const code of group.courses) {
        if (done.has(code) || targets.courseCodes.has(code)) continue;
        if (consumed.get(group.id)?.has(code) || termConsumed.get(group.id)?.has(code)) continue;
        if (isSatisfied(index.byCode.get(code)!.prerequisite, ctx)) return code;
      }
      return null;
    };

    const eligible = (item: PlanItem, sameSemester: Set<string>): boolean => {
      const ctx: PrereqContext = { ...ctxBase, sameSemester };
      if (item.kind === "slot") return slotOption(item, ctx) !== null;
      return isSatisfied(index.byCode.get(item.code)!.prerequisite, ctx);
    };

    const chosen: PlanItem[] = [];
    const chosenCodes = new Set<string>();
    let credits = 0;
    const take = (item: PlanItem) => {
      chosen.push(item);
      credits += item.credits;
      if (item.kind === "course") chosenCodes.add(item.code);
      else {
        const option = slotOption(item, { ...ctxBase, sameSemester: chosenCodes })!;
        termConsumed.set(item.groupId, (termConsumed.get(item.groupId) ?? new Set()).add(option));
      }
    };

    if (ti === 0 && input.firstSemester) {
      for (const id of input.firstSemester) {
        const item = remaining.get(id);
        if (!item) {
          firstSemesterIssues.push({
            id,
            message: index.byCode.has(id)
              ? `${courseName(index, id)} is already completed or no longer needed.`
              : "This item is no longer part of your remaining requirements.",
          });
          continue;
        }
        if (!eligible(item, chosenCodes)) {
          firstSemesterIssues.push({
            id,
            message: `${item.kind === "course" ? courseName(index, item.code) : "This elective"} isn't available yet — its prerequisites aren't complete.`,
          });
          continue;
        }
        take(item);
      }
    } else {
      let progress = true;
      while (progress) {
        progress = false;
        for (const id of sortedIds) {
          const item = remaining.get(id);
          if (!item || chosen.includes(item)) continue;
          if ((notBefore[id] ?? 0) > ti) continue;
          if (credits + item.credits > cap) continue;
          if (!eligible(item, chosenCodes)) continue;
          if (item.kind === "course") {
            const coreqs = index.byCode
              .get(item.code)!
              .corequisites.filter((c) => !done.has(c) && !chosenCodes.has(c));
            if (coreqs.length > 0) {
              const bundle = coreqs.map((c) => remaining.get(c));
              if (bundle.some((b) => !b || (notBefore[b.id] ?? 0) > ti)) continue;
              const withItem = new Set(chosenCodes).add(item.code);
              if (!bundle.every((b) => eligible(b!, withItem))) continue;
              const bundleCredits = bundle.reduce((sum, b) => sum + b!.credits, 0);
              if (credits + item.credits + bundleCredits > cap) continue;
              take(item);
              bundle.forEach((b) => take(b!));
              progress = true;
              continue;
            }
          }
          take(item);
          progress = true;
        }
      }

      // Fill pass: if a small course that nothing depends on leaves unused room, swap it for a larger
      // eligible course. More credits earlier opens credit-hour requirements (internship, capstone)
      // sooner, and the critical path is untouched because only end-of-chain courses are swapped out.
      const fits = (item: PlanItem, out: PlanItem) =>
        !chosen.includes(item) &&
        (notBefore[item.id] ?? 0) <= ti &&
        item.credits > out.credits &&
        credits - out.credits + item.credits <= cap &&
        (item.kind === "slot" || index.byCode.get(item.code)!.corequisites.length === 0);
      while (credits < cap) {
        const removable = chosen
          .filter(
            (c): c is Extract<PlanItem, { kind: "course" }> =>
              c.kind === "course" &&
              priority.get(c.id)!.height === 1 &&
              index.byCode.get(c.code)!.corequisites.length === 0,
          )
          .sort((a, b) => comparePriority(priority.get(b.id)!, priority.get(a.id)!, b.id, a.id));
        let swapped = false;
        for (const out of removable) {
          const without = new Set(chosenCodes);
          without.delete(out.code);
          const replacement = sortedIds
            .map((id) => remaining.get(id))
            .find((item): item is PlanItem => !!item && fits(item, out) && eligible(item, without));
          if (!replacement) continue;
          chosen.splice(chosen.indexOf(out), 1);
          chosenCodes.delete(out.code);
          credits -= out.credits;
          take(replacement);
          swapped = true;
          break;
        }
        if (!swapped) break;
      }
    }

    if (chosen.length === 0) {
      const waiting = [...remaining.keys()].some((id) => (notBefore[id] ?? 0) > ti);
      if (!isSummer && !waiting && !(ti === 0 && input.firstSemester)) {
        blocked = {
          message:
            "Some remaining requirements can't be scheduled because their prerequisites can never be met with the courses in this plan.",
          itemIds: [...remaining.keys()],
        };
        break;
      }
      term = nextTerm(term, settings.includeSummer);
      continue;
    }

    const scheduled: ScheduledItem[] = [];
    const passedCodes: string[] = [];
    for (const item of chosen) {
      const isCourse = item.kind === "course";
      const attempt = isCourse ? (attempts.get(item.code) ?? 0) : 0;
      if (isCourse) attempts.set(item.code, attempt + 1);
      const failed = isCourse && failOnce.has(item.code) && attempt === 0;
      scheduled.push({
        item,
        reasons: failed ? ["Simulated: this attempt is not passed, so the course is retaken later."] : reasonsFor(index, item, priority.get(item.id)!, earned),
        ...(failed ? { failed: true } : {}),
        ...(attempt > 0 ? { retake: true } : {}),
      });
      if (failed) continue;
      remaining.delete(item.id);
      placement.set(item.id, ti);
      if (isCourse) passedCodes.push(item.code);
    }
    for (const [groupId, codes] of termConsumed) {
      consumed.set(groupId, new Set([...(consumed.get(groupId) ?? []), ...codes]));
    }
    for (const code of passedCodes) done.add(code);
    const passedCredits = scheduled.filter((s) => !s.failed).reduce((sum, s) => sum + s.item.credits, 0);
    earned += passedCredits;
    counted = Math.min(index.curriculum.totalCredits, counted + passedCredits);

    semesters.push({
      index: ti,
      term,
      label: termLabel(term),
      isSummer,
      items: scheduled,
      credits,
      countedAfter: counted,
      remainingAfter: index.curriculum.totalCredits - counted,
      milestones: [],
    });
    lastUsedIndex = ti;
    term = nextTerm(term, settings.includeSummer);
  }

  if (!blocked && remaining.size > 0) {
    blocked = {
      message: "The plan needs more than 30 semesters with these settings. Try a higher credit load.",
      itemIds: [...remaining.keys()],
    };
  }

  addMilestones(index, semesters, !blocked, index.curriculum.totalCredits - remainingCreditsOf(index, completed));

  const remainingCredits = targets.items.reduce((sum, item) => sum + item.credits, 0);
  const lowerBound = computeLowerBound(settings, remainingCredits, priority);
  const unconstrained =
    !input.firstSemester && Object.keys(notBefore).length === 0 && failOnce.size === 0 && !index.hasConcurrentRules;

  return {
    semesters,
    graduationTerm: blocked || semesters.length === 0 ? null : semesters[semesters.length - 1].term,
    semesterCount: semesters.length,
    summerCount: semesters.filter((s) => s.isSummer).length,
    remainingCredits,
    blocked,
    firstSemesterIssues,
    lowerBound,
    provablyFastest: unconstrained && !blocked && semesters.length > 0 && lastUsedIndex + 1 === lowerBound,
    placement,
  };
}

function remainingCreditsOf(index: CurriculumIndex, completed: Set<string>): number {
  let counted = 0;
  for (const group of index.curriculum.groups) {
    const credits = creditsOf(
      index,
      group.courses.filter((c) => completed.has(c)),
    );
    counted += Math.min(credits, group.minCredits);
  }
  return index.curriculum.totalCredits - counted;
}

/**
 * Priority heuristic (critical path first):
 * 1. Longest chain of remaining courses that depend on it (delaying it delays all of them).
 * 2. Number of remaining courses that depend on it.
 * 3. Suggested semester in the official guidance plan.
 */
function computePriorities(
  index: CurriculumIndex,
  items: PlanItem[],
  courseCodes: Set<string>,
): Map<string, Priority> {
  const heightMemo = new Map<string, number>();
  const height = (code: string): number => {
    const memo = heightMemo.get(code);
    if (memo !== undefined) return memo;
    heightMemo.set(code, 1);
    const deps = (index.dependents.get(code) ?? []).filter((d) => courseCodes.has(d));
    const h = 1 + Math.max(0, ...deps.map(height));
    heightMemo.set(code, h);
    return h;
  };
  const downstream = (code: string): Set<string> => {
    const seen = new Set<string>();
    const stack = [code];
    while (stack.length) {
      for (const d of index.dependents.get(stack.pop()!) ?? []) {
        if (courseCodes.has(d) && !seen.has(d)) {
          seen.add(d);
          stack.push(d);
        }
      }
    }
    return seen;
  };

  const out = new Map<string, Priority>();
  for (const item of items) {
    if (item.kind === "course") {
      const course = index.byCode.get(item.code)!;
      out.set(item.id, {
        height: height(item.code),
        downstream: downstream(item.code).size,
        directDependents: (index.dependents.get(item.code) ?? []).filter((d) => courseCodes.has(d)),
        recommended: course.recommendedSemester ?? 99,
      });
    } else {
      const group = index.groupById.get(item.groupId)!;
      out.set(item.id, {
        height: 1,
        downstream: 0,
        directDependents: [],
        recommended: group.slotSemesters[item.slotIndex] ?? group.slotSemesters.at(-1) ?? 99,
      });
    }
  }
  return out;
}

function comparePriority(a: Priority, b: Priority, idA: string, idB: string): number {
  return (
    b.height - a.height ||
    b.downstream - a.downstream ||
    a.recommended - b.recommended ||
    Number(idA.startsWith("slot:")) - Number(idB.startsWith("slot:")) ||
    idA.localeCompare(idB)
  );
}

function reasonsFor(index: CurriculumIndex, item: PlanItem, p: Priority, earnedBefore: number): string[] {
  if (item.kind === "slot") {
    const group = index.groupById.get(item.groupId)!;
    return [`Counts toward your ${group.title}. Pick any course from that list you're eligible for.`];
  }
  const course = index.byCode.get(item.code)!;
  const reasons: string[] = [];
  if (p.height >= 3) {
    reasons.push(`First step in a chain of ${p.height} courses — taking it now keeps the later ones on schedule.`);
  }
  if (p.directDependents.length > 0) {
    const names = p.directDependents.slice(0, 2).map((c) => courseName(index, c));
    const more = p.directDependents.length - names.length;
    reasons.push(`Needed before ${names.join(" and ")}${more > 0 ? ` and ${more} more` : ""}.`);
  }
  const threshold = creditThreshold(course.prerequisite);
  if (threshold > 0 && reasons.length < 2) {
    reasons.push(`Opens once you have ${threshold} credit hours — you'll have ${earnedBefore}.`);
  }
  if (course.recommendedSemester && reasons.length < 2) {
    const year = Math.ceil(course.recommendedSemester / 2);
    const sem = course.recommendedSemester % 2 === 1 ? 1 : 2;
    reasons.push(`Suggested for Year ${year}, Semester ${sem} in the official plan.`);
  }
  if (reasons.length === 0) reasons.push("Required for your degree, with nothing blocking it.");
  return reasons.slice(0, 2);
}

function addMilestones(index: CurriculumIndex, semesters: PlannedSemester[], finishes: boolean, countedAtStart: number) {
  const total = index.curriculum.totalCredits;
  let before = countedAtStart;
  semesters.forEach((s, i) => {
    const categories = new Set(
      s.items
        .filter((x) => x.item.kind === "course")
        .map((x) => index.groupById.get(index.byCode.get((x.item as { code: string }).code)!.groupId)!.category),
    );
    if (categories.has("internship")) s.milestones.push("Internship");
    if (categories.has("capstone")) s.milestones.push("Capstone project");
    if (before < total / 2 && s.countedAfter >= total / 2 && s.countedAfter < total) s.milestones.push("Halfway there");
    if (finishes && i === semesters.length - 1) s.milestones.push("Degree requirements complete");
    before = s.countedAfter;
  });
}

function computeLowerBound(settings: PlanSettings, remainingCredits: number, priority: Map<string, Priority>): number {
  if (remainingCredits <= 0) return 0;
  let steps = 0;
  let capacity = 0;
  let term = settings.startTerm;
  while (capacity < remainingCredits && steps < MAX_TERMS) {
    capacity += term.season === "summer" ? settings.summerMaxCredits : settings.maxCredits;
    steps++;
    term = nextTerm(term, settings.includeSummer);
  }
  const chain = Math.max(0, ...[...priority.values()].map((p) => p.height));
  return Math.max(steps, chain);
}
