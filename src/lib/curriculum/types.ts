/**
 * Core curriculum model. Everything here is university-independent:
 * a university, major or catalog year is just data that conforms to these types.
 */

/** A prerequisite rule. Course prerequisites are separate from degree requirements. */
export type PrereqExpr =
  | {
      kind: "course";
      code: string;
      /** The course may be taken in the same semester (only when the plan explicitly allows it). */
      concurrent?: boolean;
      /** Minimum grade, shown to students but not enforced (UniPath does not track grades). */
      minGrade?: string;
    }
  /** Minimum number of completed credit hours, e.g. ">= 60 CR.H." */
  | { kind: "credits"; min: number }
  /** A condition UniPath cannot verify, e.g. department approval. Never blocks planning. */
  | { kind: "note"; text: string }
  | { kind: "all"; items: PrereqExpr[] }
  | { kind: "any"; items: PrereqExpr[] };

export type RequirementCategory =
  | "university"
  | "college"
  | "major"
  | "supporting"
  | "internship"
  | "capstone";

export type VerificationStatus = "official-transcribed" | "illustrative";

export interface Course {
  code: string;
  title: string;
  credits: number;
  prerequisite: PrereqExpr | null;
  /** The prerequisite exactly as printed in the source document, when it differs from what UniPath uses. */
  officialPrerequisiteText: string | null;
  /** Courses that must be taken in the same semester or earlier. */
  corequisites: string[];
  /** Id of the requirement group this course counts toward. */
  groupId: string;
  /** Suggested semester (1-based) from the official guidance plan, if it lists one. */
  recommendedSemester: number | null;
  /** Short, student-facing notes about this course's data. */
  notes: string[];
}

export interface RequirementGroup {
  id: string;
  /** Student-friendly name, e.g. "Society & Civilization elective". */
  title: string;
  category: RequirementCategory;
  /** "all": every listed course is required. "choose": earn minCredits from the listed options. */
  rule: "all" | "choose";
  minCredits: number;
  courses: string[];
  /** For "choose" groups: suggested semester for each elective slot. */
  slotSemesters: number[];
  description: string;
}

export interface CurriculumSource {
  kind: "study-plan" | "guidance-plan";
  title: string;
  url: string | null;
  retrieved: string | null;
}

export interface Curriculum {
  id: string;
  universityId: string;
  college: string;
  majorId: string;
  majorName: string;
  shortName: string;
  degree: string;
  version: string;
  totalCredits: number;
  /** Number of semesters in the official guidance plan. */
  plannedSemesters: number;
  verification: VerificationStatus;
  sources: CurriculumSource[];
  lastUpdated: string;
  /** Known discrepancies or interpretations, shown on the About page. */
  dataNotes: string[];
  groups: RequirementGroup[];
  courses: Course[];
}

export interface University {
  id: string;
  name: string;
  shortName: string;
  country: string;
  website: string;
}
