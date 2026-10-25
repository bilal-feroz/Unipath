"use client";

import { useMemo } from "react";
import { usePlanContext } from "@/components/app-shell/plan-context";
import { applyPolicy, rawEntries, summarize, type GradeInputs, type RepeatPolicy } from "@/lib/gpa/forecast";
import { computeGpa, ratingFor } from "@/lib/gpa/gpa";
import { scaleForUniversity } from "@/lib/gpa/scales";
import { activeProfileOf, useAppStore } from "@/lib/state/store";

/**
 * The student's recorded CGPA on their university's official scale (null scale = no verified scale
 * yet). Earlier attempts of repeated courses count according to the student's chosen policy.
 */
export function useGpa() {
  const plan = usePlanContext();
  const policy: RepeatPolicy = useAppStore((s) => activeProfileOf(s)?.life.repeatPolicy ?? "all");
  const scale = scaleForUniversity(plan.curriculum.universityId);
  const { grades, attempts, gradeTerms } = plan.record;
  const inputs = useMemo<GradeInputs | null>(
    () => (scale ? { index: plan.index, completed: plan.completed, grades, attempts, gradeTerms, scale } : null),
    [scale, plan.index, plan.completed, grades, attempts, gradeTerms],
  );
  const result = useMemo(() => {
    if (!scale || !inputs) return null;
    const base = computeGpa(plan.index, plan.completed, grades, scale);
    const counted = applyPolicy(rawEntries(inputs), policy);
    const s = summarize(counted);
    return {
      ...base,
      cgpa: s.gpa,
      rating: s.gpa === null ? null : ratingFor(s.gpa, scale),
      gradedCredits: s.credits,
      qualityPoints: s.points,
      gradedCourses: counted.length,
      attemptsCounted: counted.filter((e) => e.source === "attempt").length,
    };
  }, [scale, inputs, plan.index, plan.completed, grades, policy]);
  return { scale, result, inputs, policy };
}

export const RATING_TONE: Record<string, "done" | "accent" | "open" | "warn" | "neutral"> = {
  Excellent: "done",
  "Very Good": "accent",
  Good: "open",
  Satisfactory: "warn",
  Unsatisfactory: "warn",
};
