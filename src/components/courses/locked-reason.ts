import { describePrereq } from "@/lib/curriculum/prereq";
import { courseName, type CourseState, type CurriculumIndex } from "@/lib/engine";

/** One short line explaining what a locked course is waiting for. */
export function lockedReason(index: CurriculumIndex, state: CourseState, earnedCredits: number): string {
  const parts = state.missing.map((part) =>
    part.kind === "credits"
      ? `${part.min} credit hours (you have ${earnedCredits})`
      : describePrereq(part, (c) => courseName(index, c)),
  );
  return parts.length ? `Needs ${parts.join(" and ")}` : "";
}
