import { courseName } from "./model";
import { buildRoadmap, type Roadmap, type RoadmapInput } from "./scheduler";
import { termLabel, type Term } from "./terms";

/** A "what if" change. Simulations never modify the student's saved progress. */
export interface Scenario {
  maxCredits?: number;
  includeSummer?: boolean;
  /** Push a course back by this many semesters compared with the current plan. */
  postpone?: { code: string; semesters: number } | null;
  /** A course that has to be taken twice (the first attempt isn't passed). */
  retake?: string | null;
}

export interface AffectedCourse {
  id: string;
  title: string;
  from: string | null;
  to: string | null;
  /** Positive = later. In term steps. */
  shift: number;
}

export interface ScenarioResult {
  baseline: Roadmap;
  simulated: Roadmap;
  graduationChange: "earlier" | "later" | "same" | "unknown";
  affected: AffectedCourse[];
  reasons: string[];
  averageLoad: { baseline: number; simulated: number };
}

const SEASON_ORDER = { spring: 0, summer: 1, fall: 2 } as const;

export function termOrdinal(term: Term): number {
  return term.year * 3 + SEASON_ORDER[term.season];
}

export function isEmptyScenario(s: Scenario): boolean {
  return s.maxCredits === undefined && s.includeSummer === undefined && !s.postpone && !s.retake;
}

function labelAt(roadmap: Roadmap, index: number | undefined): string | null {
  if (index === undefined) return null;
  const semester = roadmap.semesters.find((s) => s.index === index);
  return semester ? semester.label : null;
}

function averageLoad(roadmap: Roadmap): number {
  if (roadmap.semesterCount === 0) return 0;
  const total = roadmap.semesters.reduce((sum, s) => sum + s.credits, 0);
  return Math.round((total / roadmap.semesterCount) * 10) / 10;
}

export function simulateScenario(base: RoadmapInput, scenario: Scenario): ScenarioResult {
  const { index } = base;
  const baseline = buildRoadmap(base);

  const settings = {
    ...base.settings,
    ...(scenario.maxCredits !== undefined ? { maxCredits: scenario.maxCredits } : {}),
    ...(scenario.includeSummer !== undefined ? { includeSummer: scenario.includeSummer } : {}),
  };
  const notBefore: Record<string, number> = { ...(base.notBefore ?? {}) };
  if (scenario.postpone) {
    const current = baseline.placement.get(scenario.postpone.code);
    if (current !== undefined) notBefore[scenario.postpone.code] = current + scenario.postpone.semesters;
  }
  const failOnce = [...(base.failOnce ?? []), ...(scenario.retake ? [scenario.retake] : [])];

  // Changing the semester layout makes the student's fixed first-semester plan meaningless
  // only if it's the course being postponed; otherwise keep it.
  let firstSemester = base.firstSemester ?? null;
  if (firstSemester && scenario.postpone && baseline.placement.get(scenario.postpone.code) === 0) {
    firstSemester = firstSemester.filter((id) => id !== scenario.postpone!.code);
  }

  const simulated = buildRoadmap({ ...base, settings, notBefore, failOnce, firstSemester });

  let graduationChange: ScenarioResult["graduationChange"] = "unknown";
  if (baseline.graduationTerm && simulated.graduationTerm) {
    const diff = termOrdinal(simulated.graduationTerm) - termOrdinal(baseline.graduationTerm);
    graduationChange = diff > 0 ? "later" : diff < 0 ? "earlier" : "same";
  }

  const affected: AffectedCourse[] = [];
  for (const [id, before] of baseline.placement) {
    if (id.startsWith("slot:")) continue;
    const after = simulated.placement.get(id);
    const beforeOrdinal = baseline.semesters.find((s) => s.index === before)?.term;
    const afterOrdinal = after === undefined ? undefined : simulated.semesters.find((s) => s.index === after)?.term;
    const shift =
      beforeOrdinal && afterOrdinal ? termOrdinal(afterOrdinal) - termOrdinal(beforeOrdinal) : after === undefined ? 1 : 0;
    if (shift !== 0) {
      affected.push({
        id,
        title: courseName(index, id),
        from: labelAt(baseline, before),
        to: labelAt(simulated, after),
        shift,
      });
    }
  }
  affected.sort((a, b) => b.shift - a.shift || a.title.localeCompare(b.title));

  const reasons = explain(base, scenario, baseline, simulated, graduationChange, affected);

  return {
    baseline,
    simulated,
    graduationChange,
    affected,
    reasons,
    averageLoad: { baseline: averageLoad(baseline), simulated: averageLoad(simulated) },
  };
}

function explain(
  base: RoadmapInput,
  scenario: Scenario,
  baseline: Roadmap,
  simulated: Roadmap,
  change: ScenarioResult["graduationChange"],
  affected: AffectedCourse[],
): string[] {
  const { index } = base;
  const reasons: string[] = [];
  const remaining = baseline.remainingCredits;
  const movedLater = (exclude: string) => affected.filter((a) => a.id !== exclude && a.shift > 0);
  const names = (list: AffectedCourse[]) => {
    const shown = list.slice(0, 3).map((a) => a.title);
    const more = list.length - shown.length;
    return more > 0 ? `${shown.join(", ")} and ${more} more` : shown.join(shown.length === 2 ? " and " : ", ");
  };

  if (scenario.maxCredits !== undefined && scenario.maxCredits !== base.settings.maxCredits) {
    const minSemesters = Math.ceil(remaining / scenario.maxCredits);
    reasons.push(
      `At ${scenario.maxCredits} credits per semester, your remaining ${remaining} credit hours need at least ${minSemesters} semester${minSemesters === 1 ? "" : "s"}.`,
    );
  }

  if (scenario.includeSummer !== undefined && scenario.includeSummer !== base.settings.includeSummer) {
    if (scenario.includeSummer) {
      reasons.push(
        simulated.summerCount > 0
          ? `This plan uses ${simulated.summerCount} summer term${simulated.summerCount === 1 ? "" : "s"} (up to ${base.settings.summerMaxCredits} credits each).`
          : "No summer terms were needed with these settings.",
      );
    } else {
      reasons.push("Without summer terms, all remaining courses are taken in fall and spring semesters.");
    }
  }

  if (scenario.postpone) {
    const title = courseName(index, scenario.postpone.code);
    const later = movedLater(scenario.postpone.code);
    if (baseline.placement.get(scenario.postpone.code) === undefined) {
      reasons.push(`${title} isn't in your remaining plan, so postponing it changes nothing.`);
    } else if (later.length > 0) {
      reasons.push(`${title} is needed before ${names(later)}, so ${later.length === 1 ? "that course moves" : "they move"} later too.`);
    } else {
      reasons.push(`Nothing else in your plan waits on ${title}, so the rest of it can stay where it is.`);
    }
  }

  if (scenario.retake) {
    const course = index.byCode.get(scenario.retake);
    if (course) {
      const later = movedLater(scenario.retake);
      reasons.push(`Retaking ${course.title} adds ${course.credits} credit hours to your plan.`);
      if (later.length > 0) {
        reasons.push(`Courses that need ${course.title} first move later: ${names(later)}.`);
      }
    }
  }

  if (change === "same") {
    reasons.push("Your estimated graduation stays the same.");
  } else if (change !== "unknown" && baseline.graduationTerm && simulated.graduationTerm) {
    reasons.push(
      `Estimated graduation moves ${change} — from ${termLabel(baseline.graduationTerm)} to ${termLabel(simulated.graduationTerm)}.`,
    );
  }
  if (simulated.blocked) reasons.push(simulated.blocked.message);
  return reasons;
}
