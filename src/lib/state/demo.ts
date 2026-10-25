import { occurrenceId, classOccurrences } from "@/lib/schedule/occurrences";
import {
  defaultLifeSettings,
  emptySchedule,
  type CalendarEvent,
  type LifeSettings,
  type Schedule,
  type Session,
  type Task,
} from "@/lib/schedule/schema";
import { addDays, fromMinutes, startOfWeek, toMinutes, weekday, zonedNow, type DateStr } from "@/lib/schedule/time";
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

/** Sample letter grades (made up for the demo) so the GPA tracker has something to show. CGPA 3.45. */
export const DEMO_GRADES: Record<string, string> = {
  "0102120": "A", "0107101": "B+", "0408100": "A", "0405100": "B", "0401120": "A", "0108103": "B",
  "0102220": "A", "0107200": "B+", "0107102": "B", "0108203": "C+", "0501170": "A", "0401121": "B+",
  "0103220": "A", "0107103": "B", "0102221": "B+", "0108104": "A", "0201100": "C+",
};

/** Which of the sample student's semesters each grade belongs to (for semester GPA). */
export const DEMO_GRADE_TERMS: Record<string, number> = Object.fromEntries(
  DEMO_COMPLETED.map((code, i) => [code, i < 6 ? 1 : i < 12 ? 2 : 3]),
);

/** Courses the sample student is taking this semester. */
export const DEMO_IN_PROGRESS = {
  databases: "0102330",
  dataStructures: "0102270",
  requirements: "0103320",
  projectManagement: "0103420",
  organization: "0102240",
};

export const DEMO_DESCRIPTION =
  "A sample Software Engineering student in their fourth semester, with made-up classes, rooms, deadlines and attendance.";

const C = DEMO_IN_PROGRESS;

function at(minutes: number) {
  return fromMinutes(Math.round(minutes / 5) * 5);
}

/**
 * The sample semester, built around `now` so the demo always has a class today, deadlines this week,
 * and a few conflicts to find. Everything is marked as sample data.
 */
export function demoSchedule(now: Date = new Date()): { schedule: Schedule; life: LifeSettings } {
  const zoned = zonedNow(now);
  const today = zoned.date;
  const d0 = weekday(today);
  const day = (k: number) => ((d0 - 1 + k) % 7) + 1;
  // Today's first class started a little before now (between 07:00 and 15:30).
  const base = Math.min(Math.max(Math.round((zoned.minutes - 50) / 5) * 5, 7 * 60), 15 * 60 + 30);

  const termStart = addDays(startOfWeek(today), -7 * 7);
  const s = (id: string, courseCode: string, kind: Session["kind"], days: number[], start: number, end: number, building: string, room: string, professor: string, floor = ""): Session => ({
    id: `demo-${id}`,
    courseCode,
    kind,
    days,
    start: at(start),
    end: at(end),
    professor,
    building,
    floor,
    room,
    section: "",
  });

  const sessions: Session[] = [
    s("db", C.databases, "lecture", [d0, day(2)], base, base + 75, "Building B", "204", "Dr. Ahmed", "2"),
    // Five minutes later, in another building: CampusFlow flags the tight change.
    s("ds", C.dataStructures, "lecture", [d0, day(2)], base + 80, base + 155, "Building C", "112", "Dr. Fatima", "1"),
    s("spm", C.projectManagement, "lecture", [d0, day(3)], base + 240, base + 315, "Building B", "105", "Dr. Layla", "1"),
    s("srs", C.requirements, "lecture", [day(1), day(3)], 9 * 60, 10 * 60 + 15, "Building B", "210", "Dr. Omar", "2"),
    s("co", C.organization, "lecture", [day(1)], 11 * 60, 12 * 60 + 15, "Building D", "101", "Dr. Yousef", "1"),
    s("co-lab", C.organization, "lab", [day(4)], 13 * 60, 14 * 60 + 50, "Building D", "Lab 3", "Dr. Yousef", "Ground"),
  ];

  const task = (id: string, t: Partial<Task> & Pick<Task, "title" | "type" | "dueDate">): Task => ({
    id: `demo-${id}`,
    courseCode: null,
    dueTime: null,
    durationMin: null,
    location: "",
    weight: null,
    effortHours: null,
    priority: "auto",
    done: false,
    completedAt: null,
    progress: 0,
    notes: "",
    subtasks: [],
    createdAt: now.toISOString(),
    source: "sample",
    ...t,
  });

  const tasks: Task[] = [
    task("db-a2", {
      title: "Database Systems Assignment 2",
      type: "assignment",
      courseCode: C.databases,
      dueDate: addDays(today, 1),
      dueTime: "23:59",
      weight: 15,
      effortHours: 4,
      notes: "ER diagram and normalisation to 3NF (sample).",
      subtasks: [
        { id: "demo-db-a2-1", title: "Draw the ER diagram", done: true },
        { id: "demo-db-a2-2", title: "Normalise the tables", done: false },
        { id: "demo-db-a2-3", title: "Write the SQL queries", done: false },
      ],
    }),
    task("ds-quiz", { title: "Data Structures quiz 3", type: "quiz", courseCode: C.dataStructures, dueDate: addDays(today, 2), dueTime: at(base + 80), durationMin: 20, weight: 5, location: "Building C, Room 112" }),
    task("spm-mid", { title: "Software Project Management midterm", type: "midterm", courseCode: C.projectManagement, dueDate: addDays(today, 4), dueTime: "10:00", durationMin: 90, weight: 25, location: "Building B, Room 105" }),
    task("co-mid", { title: "Computer Organization midterm", type: "midterm", courseCode: C.organization, dueDate: addDays(today, 4), dueTime: "11:00", durationMin: 90, weight: 25, location: "Building D, Room 101" }),
    task("srs-doc", { title: "SRS requirements document", type: "project", courseCode: C.requirements, dueDate: addDays(today, 5), dueTime: "23:59", weight: 20, effortHours: 10, progress: 30 }),
    task("co-lab4", { title: "Computer Organization lab report 4", type: "lab", courseCode: C.organization, dueDate: addDays(today, 5), dueTime: "23:59", weight: 5, effortHours: 2 }),
    task("ds-hw2", { title: "Data Structures homework 2", type: "assignment", courseCode: C.dataStructures, dueDate: addDays(today, -1), dueTime: "23:59", weight: 5 }),
    task("register", { title: "Course registration for next semester", type: "registration", dueDate: addDays(today, 2), dueTime: "16:00", notes: "Sample deadline — check the real date with the registrar." }),
    task("tuition", { title: "Tuition payment", type: "payment", dueDate: addDays(today, 9) }),
    task("db-a1", { title: "Database Systems Assignment 1", type: "assignment", courseCode: C.databases, dueDate: addDays(today, -6), dueTime: "23:59", weight: 10, done: true, completedAt: new Date(now.getTime() - 7 * 86_400_000).toISOString() }),
  ];

  const event = (id: string, e: Partial<CalendarEvent> & Pick<CalendarEvent, "title" | "category" | "date">): CalendarEvent => ({
    id: `demo-${id}`,
    start: null,
    end: null,
    repeat: "none",
    until: null,
    location: "",
    courseCode: null,
    notes: "",
    url: "",
    inCalendar: true,
    source: "sample",
    ...e,
  });

  const events: CalendarEvent[] = [
    event("workshop", { title: "Technology workshop", category: "workshop", date: addDays(today, 5), start: "14:00", end: "16:00", location: "Main library hall", notes: "Sample event — not an official announcement." }),
    event("study-db", { title: "Study session: Database Systems", category: "study", date: addDays(today, 1), start: "19:00", end: "20:30", repeat: "weekly", location: "Library, group room" }),
    event("add-drop", { title: "Add/drop period ends", category: "registration", date: addDays(today, 3), notes: "Sample date." }),
    event("career-fair", { title: "Career fair", category: "career-fair", date: addDays(today, 11), start: "10:00", end: "14:00", location: "Sports hall", inCalendar: false, notes: "Sample event." }),
    event("robotics", { title: "Robotics club meetup", category: "club", date: addDays(today, 3), start: "17:00", end: "18:00", repeat: "weekly", location: "Building D, Room 101", inCalendar: false, notes: "Sample event." }),
    event("hackathon", { title: "Student hackathon", category: "hackathon", date: addDays(today, 16), location: "Innovation hub", inCalendar: false, notes: "Sample event." }),
    event("seminar", { title: "Cybersecurity seminar", category: "seminar", date: addDays(today, 8), start: "12:30", end: "13:30", location: "Auditorium", inCalendar: false, notes: "Sample event." }),
  ];

  const schedule: Schedule = {
    ...emptySchedule(),
    term: {
      name: "This semester (sample)",
      start: termStart,
      end: addDays(termStart, 7 * 16 - 1),
      holidays: [{ id: "demo-holiday", name: "Public holiday (sample)", start: addDays(termStart, 7 * 3 + 2), end: addDays(termStart, 7 * 3 + 2) }],
    },
    sessions,
    tasks,
    events,
    buildings: [
      { id: "demo-bldg-b", name: "Building B", notes: "Sample note: the entrance by the car park is closest to Room 204.", mapUrl: "" },
    ],
    sampleDate: today,
  };

  // A cancelled class and a makeup class in the coming days.
  const coNext = classOccurrences(schedule, addDays(today, 1), addDays(today, 7)).find((o) => o.sessionId === "demo-co");
  if (coNext) {
    schedule.exceptions = [
      { id: "demo-ex-co", sessionId: "demo-co", date: coNext.date, type: "cancelled", toDate: null, start: null, end: null, building: null, room: null, note: "Instructor away (sample)." },
    ];
  }
  schedule.extras = [
    { id: "demo-makeup", courseCode: C.organization, kind: "lecture", date: addDays(today, 5), start: "15:00", end: "16:15", professor: "Dr. Yousef", building: "Building D", floor: "1", room: "101", note: "Makeup for the cancelled class (sample)." },
  ];

  // Attendance so far: mostly present, with Data Structures close to the sample limit.
  const past = classOccurrences(schedule, termStart, today).filter(
    (o) => o.status === "scheduled" && (o.date < today || toMinutes(o.end) <= zoned.minutes),
  );
  const dsPast = past.filter((o) => o.courseCode === C.dataStructures);
  const dsAbsent = new Set(dsPast.slice(2, 5).map((o) => o.id));
  const dsLate = dsPast[6]?.id;
  const srsAbsent = past.find((o) => o.courseCode === C.requirements)?.id;
  const lastDb = past.filter((o) => o.courseCode === C.databases).at(-1)?.id;
  for (const o of past) {
    if (o.id === lastDb) continue; // left unmarked, so the student is asked to record it
    schedule.attendance[o.id] = dsAbsent.has(o.id) || o.id === srsAbsent ? "absent" : o.id === dsLate ? "late" : "present";
  }

  const life = defaultLifeSettings();
  life.attendance = { ...life.attendance, rule: "max-absences", maxAbsences: 4, warnAt: 1 };
  return { schedule, life };
}

function withSampleForecast(profile: Profile): Profile {
  const record = profile.progress[DEMO_CURRICULUM_ID];
  if (!record) return profile;
  const current = Object.values(DEMO_IN_PROGRESS);
  return {
    ...profile,
    progress: {
      ...profile.progress,
      [DEMO_CURRICULUM_ID]: {
        ...record,
        inProgress: record.inProgress.length ? record.inProgress : current,
        gradeTerms: Object.keys(record.gradeTerms).length ? record.gradeTerms : { ...DEMO_GRADE_TERMS },
        forecast:
          Object.keys(record.forecast.expected).length > 0
            ? record.forecast
            : {
                best: Object.fromEntries(current.map((c) => [c, "A"])),
                expected: { [C.databases]: "A", [C.dataStructures]: "B+", [C.requirements]: "A", [C.projectManagement]: "A", [C.organization]: "B" },
                worst: Object.fromEntries(current.map((c) => [c, "C"])),
              },
      },
    },
  };
}

/**
 * Demos saved before the GPA tracker existed have no grades at all; give them the sample grades for the
 * courses they've completed. Returns the same object when nothing needs to change.
 */
export function withDemoGrades(profile: Profile): Profile {
  const progress = profile.progress[DEMO_CURRICULUM_ID];
  if (!progress || Object.keys(progress.grades ?? {}).length > 0) return profile;
  const grades = Object.fromEntries(Object.entries(DEMO_GRADES).filter(([code]) => progress.completed.includes(code)));
  if (Object.keys(grades).length === 0) return profile;
  return { ...profile, progress: { ...profile.progress, [DEMO_CURRICULUM_ID]: { ...progress, grades } } };
}

/**
 * Brings a saved demo up to date: sample grades, current courses and forecast if missing, and a fresh
 * sample schedule each day (so "today" always has classes and deadlines). Other demo edits are kept.
 */
export function refreshDemo(profile: Profile, now: Date = new Date()): Profile {
  let p = withSampleForecast(withDemoGrades(profile));
  const today = zonedNow(now).date;
  if (p.schedules[DEMO_CURRICULUM_ID]?.sampleDate !== today) {
    const { schedule, life } = demoSchedule(now);
    p = { ...p, schedules: { ...p.schedules, [DEMO_CURRICULUM_ID]: schedule }, life };
  }
  return p;
}

export function demoProfile(now: Date = new Date()): Profile {
  const profile = newProfile("aau", DEMO_CURRICULUM_ID, now);
  profile.progress[DEMO_CURRICULUM_ID] = {
    completed: [...DEMO_COMPLETED],
    nextSemester: null,
    electiveChoices: {},
    inProgress: [],
    grades: { ...DEMO_GRADES },
    gradeTerms: {},
    attempts: [],
    forecast: { best: {}, expected: {}, worst: {} },
    updatedAt: now.toISOString(),
  };
  return refreshDemo(profile, now);
}

/** For tests: the sample meeting id of a session on a date. */
export function demoOccurrence(sessionKey: string, date: DateStr): string {
  return occurrenceId(`demo-${sessionKey}`, date);
}
