"use client";

import { useMemo } from "react";
import { usePlanContext } from "@/components/app-shell/plan-context";
import { computeGpa } from "@/lib/gpa/gpa";
import { scaleForUniversity } from "@/lib/gpa/scales";

/** The student's CGPA on their university's official scale (null scale = no verified scale yet). */
export function useGpa() {
  const plan = usePlanContext();
  const scale = scaleForUniversity(plan.curriculum.universityId);
  const result = useMemo(
    () => (scale ? computeGpa(plan.index, plan.completed, plan.record.grades, scale) : null),
    [scale, plan.index, plan.completed, plan.record.grades],
  );
  return { scale, result };
}

export const RATING_TONE: Record<string, "done" | "accent" | "open" | "warn" | "neutral"> = {
  Excellent: "done",
  "Very Good": "accent",
  Good: "open",
  Satisfactory: "warn",
  Unsatisfactory: "warn",
};
