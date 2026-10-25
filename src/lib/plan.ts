import type { Curriculum } from "@/lib/curriculum/types";
import {
  buildRoadmap,
  courseImpact,
  courseStates,
  evaluateProgress,
  indexCurriculum,
  knownCodes,
  nextStepInsight,
  termLabel,
  termOrdinal,
  type CourseState,
  type CurriculumIndex,
  type DegreeProgress,
  type Insight,
  type PlanSettings,
  type Roadmap,
  type RoadmapInput,
  type ScheduledItem,
} from "@/lib/engine";
import type { CurriculumProgress, Preferences } from "@/lib/state/schema";

/** Everything the screens need, derived from saved progress by the planning engine. */
export interface PlanView {
  curriculum: Curriculum;
  index: CurriculumIndex;
  record: CurriculumProgress;
  completed: Set<string>;
  progress: DegreeProgress;
  settings: PlanSettings;
  /** The engine's own recommendation. */
  recommended: Roadmap;
  /** The plan in effect: the student's next semester (if customized) followed by the engine's plan. */
  roadmap: Roadmap;
  nextItems: ScheduledItem[];
  plannedCodes: string[];
  states: Map<string, CourseState>;
  insight: Insight | null;
  isCustomized: boolean;
  /** When the student's own next semester delays graduation compared with the recommendation. */
  customDelay: { from: string; to: string; reason: string } | null;
  baseInput: RoadmapInput;
}

export function computePlan(curriculum: Curriculum, record: CurriculumProgress, preferences: Preferences): PlanView {
  const index = indexCurriculum(curriculum);
  const completed = knownCodes(index, record.completed);
  const progress = evaluateProgress(index, record.completed);
  const settings: PlanSettings = { ...preferences };
  const base: RoadmapInput = { index, completed, electiveChoices: record.electiveChoices, settings };
  const recommended = buildRoadmap(base);
  const isCustomized = record.nextSemester !== null;
  const roadmap = isCustomized ? buildRoadmap({ ...base, firstSemester: record.nextSemester }) : recommended;
  const first = roadmap.semesters[0];
  const nextItems = first && first.index === 0 ? first.items : [];
  const plannedCodes = nextItems.flatMap((s) => (s.item.kind === "course" ? [s.item.code] : []));
  const states = courseStates(index, completed, plannedCodes);
  const insight = nextStepInsight(index, completed, plannedCodes, record.electiveChoices);

  let customDelay: PlanView["customDelay"] = null;
  if (isCustomized && recommended.graduationTerm && roadmap.graduationTerm) {
    if (termOrdinal(roadmap.graduationTerm) > termOrdinal(recommended.graduationTerm)) {
      const recommendedFirst = recommended.semesters[0]?.items ?? [];
      const dropped = recommendedFirst
        .flatMap((s) => (s.item.kind === "course" ? [s.item.code] : []))
        .filter((code) => !plannedCodes.includes(code))
        .map((code) => courseImpact(index, completed, code, record.electiveChoices))
        .sort((a, b) => b.chainLength - a.chainLength || b.downstream.length - a.downstream.length);
      const key = dropped[0];
      customDelay = {
        from: termLabel(recommended.graduationTerm),
        to: termLabel(roadmap.graduationTerm),
        reason: key
          ? key.downstream.length > 0
            ? `${key.title} isn't in your plan, and ${key.downstream.length} later course${key.downstream.length === 1 ? "" : "s"} can't start until it's done.`
            : `Leaving out ${key.title} means there's more left to fit into later semesters.`
          : "Your plan has fewer credits than recommended, so more is left for later semesters.",
      };
    }
  }

  return {
    curriculum,
    index,
    record,
    completed,
    progress,
    settings,
    recommended,
    roadmap,
    nextItems,
    plannedCodes,
    states,
    insight,
    isCustomized,
    customDelay,
    baseInput: isCustomized ? { ...base, firstSemester: record.nextSemester } : base,
  };
}
