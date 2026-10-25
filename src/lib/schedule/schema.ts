import { z } from "zod";
import { isValidDate, TIME_RE, toMinutes } from "./time";

/**
 * Everything a student keeps for the current semester: timetable, tasks, events, attendance and the
 * state of alerts and notifications. Stored per profile and per major, separately from degree progress.
 */

const date = z.string().refine(isValidDate, "Invalid date");
const time = z.string().regex(TIME_RE, "Invalid time");
const id = z.string().min(1).max(80);
const text = (max: number) => z.string().max(max).default("");

export const SESSION_KINDS = ["lecture", "lab", "tutorial"] as const;
export type SessionKind = (typeof SESSION_KINDS)[number];

/** A weekly class: one course can have several (e.g. two lectures and a lab). */
export const sessionSchema = z
  .object({
    id,
    courseCode: z.string().min(1).max(20),
    kind: z.enum(SESSION_KINDS),
    /** ISO weekdays, 1 = Monday … 7 = Sunday. */
    days: z.array(z.number().int().min(1).max(7)).min(1).max(7),
    start: time,
    end: time,
    professor: text(80),
    building: text(80),
    floor: text(20),
    room: text(30),
    section: text(20),
  })
  .refine((s) => toMinutes(s.end) > toMinutes(s.start), "A class must end after it starts");

/** A change to one meeting of a weekly class: cancelled, or moved to another time or room. */
export const exceptionSchema = z.object({
  id,
  sessionId: id,
  /** The date the class would normally meet. */
  date,
  type: z.enum(["cancelled", "moved"]),
  toDate: date.nullable().default(null),
  start: time.nullable().default(null),
  end: time.nullable().default(null),
  building: z.string().max(80).nullable().default(null),
  room: z.string().max(30).nullable().default(null),
  note: text(200),
});

/** A one-off class, such as a makeup lecture. */
export const extraClassSchema = z
  .object({
    id,
    courseCode: z.string().min(1).max(20),
    kind: z.enum(SESSION_KINDS),
    date,
    start: time,
    end: time,
    professor: text(80),
    building: text(80),
    floor: text(20),
    room: text(30),
    note: text(200),
  })
  .refine((s) => toMinutes(s.end) > toMinutes(s.start), "A class must end after it starts");

export const holidaySchema = z.object({ id, name: z.string().min(1).max(80), start: date, end: date });

export const termSchema = z
  .object({
    name: z.string().min(1).max(40),
    start: date,
    end: date,
    holidays: z.array(holidaySchema).default([]),
  })
  .refine((t) => t.end >= t.start, "The semester must end after it starts");

export const TASK_TYPES = [
  "assignment",
  "project",
  "quiz",
  "midterm",
  "final",
  "exam",
  "presentation",
  "lab",
  "registration",
  "payment",
  "admin",
  "other",
] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const subtaskSchema = z.object({ id, title: z.string().min(1).max(120), done: z.boolean().default(false) });

export const taskSchema = z.object({
  id,
  title: z.string().min(1).max(140),
  type: z.enum(TASK_TYPES),
  courseCode: z.string().max(20).nullable().default(null),
  dueDate: date,
  /** Deadline time, or the start time for exams and presentations. Null = end of day. */
  dueTime: time.nullable().default(null),
  /** Length of an exam or presentation, if known. */
  durationMin: z.number().int().min(5).max(600).nullable().default(null),
  location: text(120),
  /** Share of the course grade, in percent, if known. */
  weight: z.number().min(0).max(100).nullable().default(null),
  /** The student's estimate of the work left, in hours. */
  effortHours: z.number().min(0).max(500).nullable().default(null),
  /** "auto" = UniPath ranks it; otherwise the student's own choice. */
  priority: z.enum(["auto", "low", "medium", "high"]).default("auto"),
  done: z.boolean().default(false),
  completedAt: z.string().nullable().default(null),
  /** Manual progress when there are no subtasks (0–100). */
  progress: z.number().min(0).max(100).default(0),
  notes: text(2000),
  subtasks: z.array(subtaskSchema).max(30).default([]),
  createdAt: z.string(),
  source: z.enum(["manual", "imported", "sample"]).default("manual"),
});

export const EVENT_CATEGORIES = [
  "university",
  "club",
  "workshop",
  "seminar",
  "competition",
  "hackathon",
  "career-fair",
  "announcement",
  "registration",
  "admin",
  "study",
  "personal",
] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export const eventSchema = z
  .object({
    id,
    title: z.string().min(1).max(140),
    category: z.enum(EVENT_CATEGORIES),
    date,
    /** Null start = all day. */
    start: time.nullable().default(null),
    end: time.nullable().default(null),
    repeat: z.enum(["none", "weekly"]).default("none"),
    /** Last date of a weekly repeat (defaults to the end of the semester). */
    until: date.nullable().default(null),
    location: text(120),
    courseCode: z.string().max(20).nullable().default(null),
    notes: text(1000),
    url: z.string().max(300).default(""),
    /** Shown on the calendar. Campus events can be browsed without being added. */
    inCalendar: z.boolean().default(true),
    source: z.enum(["manual", "imported", "sample"]).default("manual"),
  })
  .refine((e) => !e.start || !e.end || toMinutes(e.end) > toMinutes(e.start), "An event must end after it starts");

export const ATTENDANCE_MARKS = ["present", "absent", "late", "excused"] as const;
export type AttendanceMark = (typeof ATTENDANCE_MARKS)[number];

/** A building the student wants to remember, with optional directions link. */
export const buildingNoteSchema = z.object({
  id,
  name: z.string().min(1).max(80),
  notes: text(300),
  mapUrl: z.string().max(500).default(""),
});

export const scheduleSchema = z.object({
  term: termSchema.nullable().default(null),
  sessions: z.array(sessionSchema).max(80).default([]),
  exceptions: z.array(exceptionSchema).max(400).default([]),
  extras: z.array(extraClassSchema).max(100).default([]),
  tasks: z.array(taskSchema).max(500).default([]),
  events: z.array(eventSchema).max(500).default([]),
  /** Occurrence id ("sessionId@date" or "extra:id") -> mark. */
  attendance: z.record(z.string(), z.enum(ATTENDANCE_MARKS)).default({}),
  alerts: z
    .object({
      dismissed: z.array(z.string()).default([]),
      resolved: z.array(z.string()).default([]),
      /** Alert id -> ISO time until which it's hidden. */
      snoozed: z.record(z.string(), z.string()).default({}),
    })
    .default({ dismissed: [], resolved: [], snoozed: {} }),
  notifications: z
    .object({
      read: z.array(z.string()).default([]),
      /** Already shown as a browser notification. */
      delivered: z.array(z.string()).default([]),
    })
    .default({ read: [], delivered: [] }),
  buildings: z.array(buildingNoteSchema).max(100).default([]),
  /** For the demo student: the day its sample schedule was generated. */
  sampleDate: date.nullable().default(null),
});

const attendanceRuleSchema = z.object({
  /** "none" = no rule set; UniPath then shows percentages only. */
  rule: z.enum(["none", "max-absences", "min-percent"]).default("none"),
  maxAbsences: z.number().int().min(0).max(100).default(6),
  minPercent: z.number().min(1).max(100).default(75),
});

/** Profile-wide settings for the student's day-to-day features. */
export const lifeSettingsSchema = z.object({
  /** Campus time zone; null = this device's time zone. */
  timeZone: z.string().max(60).nullable().default(null),
  /** Minutes before; null = no reminder. */
  reminders: z
    .object({
      classes: z.number().int().min(0).max(1440).nullable().default(15),
      assignments: z.number().int().min(0).max(20160).nullable().default(1440),
      exams: z.number().int().min(0).max(20160).nullable().default(4320),
      deadlines: z.number().int().min(0).max(20160).nullable().default(120),
      events: z.number().int().min(0).max(10080).nullable().default(60),
    })
    .default({ classes: 15, assignments: 1440, exams: 4320, deadlines: 120, events: 60 }),
  browserNotifications: z.boolean().default(false),
  /** Conflict checks (all the student's own thresholds). */
  travelBufferMin: z.number().int().min(0).max(120).default(10),
  examGapMin: z.number().int().min(0).max(600).default(60),
  clusterThreshold: z.number().int().min(2).max(6).default(2),
  adminWarnDays: z.number().int().min(1).max(30).default(3),
  attendance: attendanceRuleSchema
    .extend({
      late: z.enum(["present", "absent"]).default("present"),
      /** Warn when this many absences (or fewer) are left. */
      warnAt: z.number().int().min(0).max(20).default(1),
      perCourse: z.record(z.string(), attendanceRuleSchema).default({}),
    })
    .default({ rule: "none", maxAbsences: 6, minPercent: 75, late: "present", warnAt: 1, perCourse: {} }),
  /** How repeated courses count in the GPA (the university's policy, chosen by the student). */
  repeatPolicy: z.enum(["all", "latest"]).default("all"),
  gpaTarget: z.number().min(0).max(5).nullable().default(null),
  /** Optional setup steps the student skipped or finished, and whether the checklist is hidden. */
  setup: z
    .object({ skipped: z.array(z.string()).default([]), hidden: z.boolean().default(false) })
    .default({ skipped: [], hidden: false }),
});

export type Session = z.infer<typeof sessionSchema>;
export type ClassException = z.infer<typeof exceptionSchema>;
export type ExtraClass = z.infer<typeof extraClassSchema>;
export type Holiday = z.infer<typeof holidaySchema>;
export type Term = z.infer<typeof termSchema>;
export type Task = z.infer<typeof taskSchema>;
export type Subtask = z.infer<typeof subtaskSchema>;
export type CalendarEvent = z.infer<typeof eventSchema>;
export type BuildingNote = z.infer<typeof buildingNoteSchema>;
export type Schedule = z.infer<typeof scheduleSchema>;
export type LifeSettings = z.infer<typeof lifeSettingsSchema>;
export type AttendanceRule = z.infer<typeof attendanceRuleSchema>;

export function emptySchedule(): Schedule {
  return scheduleSchema.parse({});
}

export function defaultLifeSettings(): LifeSettings {
  return lifeSettingsSchema.parse({});
}

export function newId(prefix: string): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

export const TASK_TYPE_LABEL: Record<TaskType, string> = {
  assignment: "Assignment",
  project: "Project",
  quiz: "Quiz",
  midterm: "Midterm",
  final: "Final exam",
  exam: "Exam",
  presentation: "Presentation",
  lab: "Lab report",
  registration: "Registration",
  payment: "Payment",
  admin: "Admin deadline",
  other: "Other",
};

export const EVENT_CATEGORY_LABEL: Record<EventCategory, string> = {
  university: "University event",
  club: "Club activity",
  workshop: "Workshop",
  seminar: "Seminar",
  competition: "Competition",
  hackathon: "Hackathon",
  "career-fair": "Career fair",
  announcement: "Announcement",
  registration: "Registration",
  admin: "Admin deadline",
  study: "Study session",
  personal: "Personal",
};

export const SESSION_KIND_LABEL: Record<SessionKind, string> = { lecture: "Lecture", lab: "Lab", tutorial: "Tutorial" };

export const EXAM_TYPES: ReadonlySet<TaskType> = new Set(["quiz", "midterm", "final", "exam"]);
export const TIMED_TYPES: ReadonlySet<TaskType> = new Set(["quiz", "midterm", "final", "exam", "presentation"]);
export const ADMIN_TYPES: ReadonlySet<TaskType> = new Set(["registration", "payment", "admin"]);
export const CAMPUS_CATEGORIES: ReadonlySet<EventCategory> = new Set([
  "university",
  "club",
  "workshop",
  "seminar",
  "competition",
  "hackathon",
  "career-fair",
  "announcement",
]);
