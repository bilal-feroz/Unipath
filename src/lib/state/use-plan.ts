"use client";

import { useMemo } from "react";
import { getCurriculum } from "@/lib/curriculum/registry";
import { computePlan, type PlanView } from "@/lib/plan";
import { emptyProgress } from "./persistence";
import { activeProfileOf, useAppStore } from "./store";

export function useActiveProfile() {
  return useAppStore((s) => activeProfileOf(s));
}

/** The derived plan for the active profile, or null if no major has been chosen yet. */
export function usePlan(): PlanView | null {
  const profile = useActiveProfile();
  const curriculum = getCurriculum(profile?.curriculumId);
  const record = (profile && curriculum && profile.progress[curriculum.id]) || null;
  const preferences = profile?.preferences;
  return useMemo(
    () => (curriculum && preferences ? computePlan(curriculum, record ?? emptyProgress(), preferences) : null),
    [curriculum, record, preferences],
  );
}
