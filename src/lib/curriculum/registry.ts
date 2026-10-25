import computerScience from "@/data/curricula/aau/computer-science.json";
import cybersecurity from "@/data/curricula/aau/cybersecurity.json";
import softwareEngineering from "@/data/curricula/aau/software-engineering.json";
import { loadCurriculum, type LoadResult } from "./load";
import type { Curriculum, University } from "./types";

/**
 * The registry of available universities and curricula.
 * To add a major: drop a data file in src/data/curricula/<university>/ and list it below.
 * No planning code needs to change.
 */

export const universities: University[] = [
  {
    id: "aau",
    name: "Al Ain University",
    shortName: "AAU",
    country: "United Arab Emirates",
    website: "https://aau.ac.ae",
  },
];

const rawCurricula: unknown[] = [softwareEngineering, computerScience, cybersecurity];

export interface RegistryEntry extends LoadResult {
  /** Present even when the data failed to load, so the problem can be reported. */
  sourceId: string;
}

const entries: RegistryEntry[] = rawCurricula.map((raw) => ({
  ...loadCurriculum(raw),
  sourceId: (raw as { id?: string })?.id ?? "unknown",
}));

/** Every registry entry, including ones with data errors (for diagnostics and tests). */
export function allRegistryEntries(): RegistryEntry[] {
  return entries;
}

/** Only curricula that loaded and passed validation are offered to students. */
export const curricula: Curriculum[] = entries.filter((e) => e.ok && e.curriculum).map((e) => e.curriculum!);

const byId = new Map(curricula.map((c) => [c.id, c]));

export function getCurriculum(id: string | null | undefined): Curriculum | null {
  return (id && byId.get(id)) || null;
}

export function getUniversity(id: string | null | undefined): University | null {
  return universities.find((u) => u.id === id) ?? null;
}

export function curriculaForUniversity(universityId: string): Curriculum[] {
  return curricula.filter((c) => c.universityId === universityId);
}

/** Majors at a university, grouped by college, each with its available curriculum versions. */
export function majorsByCollege(universityId: string) {
  const colleges = new Map<string, Map<string, Curriculum[]>>();
  for (const c of curriculaForUniversity(universityId)) {
    const majors = colleges.get(c.college) ?? new Map<string, Curriculum[]>();
    majors.set(c.majorId, [...(majors.get(c.majorId) ?? []), c]);
    colleges.set(c.college, majors);
  }
  return [...colleges.entries()].map(([college, majors]) => ({
    college,
    majors: [...majors.entries()].map(([majorId, versions]) => ({
      majorId,
      majorName: versions[0].majorName,
      degree: versions[0].degree,
      versions,
    })),
  }));
}
