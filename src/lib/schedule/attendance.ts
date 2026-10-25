import { classOccurrences, type ClassOccurrence } from "./occurrences";
import type { AttendanceMark, AttendanceRule, LifeSettings, Schedule } from "./schema";
import { toMinutes, type ZonedNow } from "./time";

export type AttendanceRisk = "ok" | "warning" | "exceeded" | "no-rule";

export interface CourseAttendance {
  courseCode: string;
  /** Class meetings that have already happened (not cancelled, not holidays). */
  held: ClassOccurrence[];
  /** Held meetings with no mark yet. */
  unrecorded: ClassOccurrence[];
  /** Meetings still to come this semester. */
  upcoming: ClassOccurrence[];
  present: number;
  late: number;
  absent: number;
  excused: number;
  /** Absences as the rule counts them (late can count as absent). */
  absences: number;
  /** Marked meetings that count toward the percentage (excused ones don't). */
  countable: number;
  attended: number;
  /** Null until at least one meeting is marked. */
  percent: number | null;
  rule: AttendanceRule;
  /** Total absences the rule allows this semester (null without a rule). */
  allowedAbsences: number | null;
  /** Allowed minus taken (negative = over the limit). */
  remainingAbsences: number | null;
  risk: AttendanceRisk;
  /** How the allowance was worked out, for the student to check. */
  basis: string;
}

export function ruleFor(settings: LifeSettings, courseCode: string): AttendanceRule {
  return settings.attendance.perCourse[courseCode] ?? settings.attendance;
}

export function isPast(o: ClassOccurrence, now: ZonedNow): boolean {
  return o.date < now.date || (o.date === now.date && toMinutes(o.end) <= now.minutes);
}

export function courseAttendance(schedule: Schedule, settings: LifeSettings, courseCode: string, now: ZonedNow): CourseAttendance {
  const term = schedule.term;
  const all = term ? classOccurrences(schedule, term.start, term.end).filter((o) => o.courseCode === courseCode && o.status === "scheduled") : [];
  const held = all.filter((o) => isPast(o, now));
  const upcoming = all.filter((o) => !isPast(o, now));
  const marks = held.map((o) => schedule.attendance[o.id] as AttendanceMark | undefined);
  const count = (m: AttendanceMark) => marks.filter((x) => x === m).length;
  const present = count("present");
  const late = count("late");
  const absent = count("absent");
  const excused = count("excused");
  const lateIsAbsent = settings.attendance.late === "absent";
  const absences = absent + (lateIsAbsent ? late : 0);
  const attended = present + (lateIsAbsent ? 0 : late);
  const countable = present + late + absent;
  const percent = countable > 0 ? Math.round((attended / countable) * 1000) / 10 : null;
  const rule = ruleFor(settings, courseCode);

  let allowedAbsences: number | null = null;
  let basis = "No attendance rule set. Add your university's rule to see how many classes you can miss.";
  if (rule.rule === "max-absences") {
    allowedAbsences = rule.maxAbsences;
    basis = `Your rule: at most ${rule.maxAbsences} absences this semester.`;
  } else if (rule.rule === "min-percent") {
    // Every meeting this semester counts, minus excused ones.
    const total = all.length - excused;
    allowedAbsences = Math.floor(total * (1 - rule.minPercent / 100) + 1e-9);
    basis = `Your rule: attend at least ${rule.minPercent}% of the ${total} classes scheduled this semester.`;
  }
  const remainingAbsences = allowedAbsences === null ? null : allowedAbsences - absences;
  const risk: AttendanceRisk =
    remainingAbsences === null
      ? "no-rule"
      : remainingAbsences < 0
        ? "exceeded"
        : remainingAbsences <= settings.attendance.warnAt
          ? "warning"
          : "ok";

  return {
    courseCode,
    held,
    unrecorded: held.filter((o) => !schedule.attendance[o.id]),
    upcoming,
    present,
    late,
    absent,
    excused,
    absences,
    countable,
    attended,
    percent,
    rule,
    allowedAbsences,
    remainingAbsences,
    risk,
    basis,
  };
}

/** Courses with at least one class in the timetable. */
export function timetableCourses(schedule: Schedule): string[] {
  return [...new Set([...schedule.sessions.map((s) => s.courseCode), ...schedule.extras.map((x) => x.courseCode)])];
}

/** Attendance percentage if the next class is missed. */
export function percentIfMissNext(a: CourseAttendance): number {
  const countable = a.countable + 1;
  return Math.round((a.attended / countable) * 1000) / 10;
}

/**
 * The fewest of the remaining classes the student must attend to finish the semester at or above
 * `targetPercent`. Null when it's no longer possible.
 */
export function classesNeededFor(a: CourseAttendance, targetPercent: number): number | null {
  const remaining = a.upcoming.length;
  const finalCountable = a.countable + remaining;
  if (finalCountable === 0) return 0;
  const needed = Math.ceil((targetPercent / 100) * finalCountable - a.attended - 1e-9);
  const x = Math.max(0, needed);
  return x > remaining ? null : x;
}

/** The best percentage still reachable by attending every remaining class. */
export function bestReachablePercent(a: CourseAttendance): number | null {
  const finalCountable = a.countable + a.upcoming.length;
  if (finalCountable === 0) return null;
  return Math.round(((a.attended + a.upcoming.length) / finalCountable) * 1000) / 10;
}
