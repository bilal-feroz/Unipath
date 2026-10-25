import { newProfile } from "./persistence";
import type { Profile } from "./schema";

export const DEMO_CURRICULUM_ID = "aau-bsc-software-engineering";

/**
 * A sample Software Engineering student: the first three semesters of the official guidance plan,
 * except Calculus II, which they haven't taken yet. Real planning logic runs on this data.
 */
export const DEMO_COMPLETED = [
  // Year 1, Semester 1
  "0102120", "0107101", "0408100", "0405100", "0401120", "0108103",
  // Year 1, Semester 2
  "0102220", "0107200", "0107102", "0108203", "0501170", "0401121",
  // Year 2, Semester 1 (without Calculus II, 0107104)
  "0103220", "0107103", "0102221", "0108104", "0201100",
];

export const DEMO_DESCRIPTION =
  "A sample Software Engineering student who has finished three semesters but hasn't taken Calculus II yet.";

export function demoProfile(now: Date = new Date()): Profile {
  const profile = newProfile("aau", DEMO_CURRICULUM_ID, now);
  profile.progress[DEMO_CURRICULUM_ID] = {
    completed: [...DEMO_COMPLETED],
    nextSemester: null,
    electiveChoices: {},
    updatedAt: now.toISOString(),
  };
  return profile;
}
