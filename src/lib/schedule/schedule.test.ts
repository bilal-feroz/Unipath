import { beforeEach, describe, expect, it } from "vitest";
import { getCurriculum } from "@/lib/curriculum/registry";
import { indexCurriculum } from "@/lib/engine/model";
import { applyPolicy, forecastCgpa, rawEntries, requiredForTarget, semesterHistory, summarize, type GradeInputs } from "@/lib/gpa/forecast";
import { AAU_UNDERGRADUATE } from "@/lib/gpa/scales";
import { DEMO_IN_PROGRESS, demoProfile } from "@/lib/state/demo";
import { activeProfileOf, scheduleOf, useAppStore } from "@/lib/state/store";
import { agendaItems } from "./agenda";
import { classesNeededFor, courseAttendance, percentIfMissNext } from "./attendance";
import { detectConflicts, visibleAlerts } from "./conflicts";
import { classOccurrences } from "./occurrences";
import { todaysPriorities } from "./priorities";
import { dueNotifications } from "./reminders";
import { defaultLifeSettings, emptySchedule, type LifeSettings, type Schedule, type Session, type Task } from "./schema";
import { rankTasks, tasksForView } from "./tasks";
import { addDays, formatTime, minutesUntil, weekday, zonedNow, type ZonedNow } from "./time";

const title = (code: string) => `Course ${code}`;
const at = (date: string, minutes: number): ZonedNow => ({ date, minutes, timeZone: "Asia/Dubai" });

function session(id: string, over: Partial<Session> = {}): Session {
  return { id, courseCode: id.toUpperCase(), kind: "lecture", days: [1], start: "09:00", end: "10:15", professor: "", building: "", floor: "", room: "", section: "", ...over };
}

function task(id: string, over: Partial<Task> = {}): Task {
  return {
    id, title: id, type: "assignment", courseCode: null, dueDate: "2026-11-10", dueTime: null, durationMin: null, location: "",
    weight: null, effortHours: null, priority: "auto", done: false, completedAt: null, progress: 0, notes: "", subtasks: [],
    createdAt: "2026-10-01T00:00:00.000Z", source: "manual", ...over,
  };
}

function sched(over: Partial<Schedule> = {}): Schedule {
  return { ...emptySchedule(), term: { name: "Fall", start: "2026-11-02", end: "2026-11-29", holidays: [] }, ...over };
}

const settings = (over: Partial<LifeSettings> = {}): LifeSettings => ({ ...defaultLifeSettings(), ...over });

describe("dates and time zones", () => {
  it("works out today in the campus time zone, not the device's", () => {
    const instant = new Date("2026-10-25T21:30:00Z");
    expect(zonedNow(instant, "Asia/Dubai")).toMatchObject({ date: "2026-10-26", minutes: 90 });
    expect(zonedNow(instant, "America/New_York")).toMatchObject({ date: "2026-10-25", minutes: 17 * 60 + 30 });
  });

  it("does date arithmetic and weekdays", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(weekday("2026-11-02")).toBe(1);
    expect(weekday("2026-11-08")).toBe(7);
    expect(formatTime("13:05")).toBe("1:05 PM");
    expect(minutesUntil(at("2026-11-02", 600), "2026-11-03", "09:00")).toBe(24 * 60 - 60);
  });
});

describe("timetable", () => {
  it("expands weekly classes, applying cancellations, moves, holidays and makeup classes", () => {
    const s = sched({
      term: { name: "Fall", start: "2026-11-02", end: "2026-11-15", holidays: [{ id: "h", name: "National Day", start: "2026-11-11", end: "2026-11-11" }] },
      sessions: [session("db", { days: [1, 3], building: "B", room: "204" })],
      exceptions: [
        { id: "x1", sessionId: "db", date: "2026-11-04", type: "cancelled", toDate: null, start: null, end: null, building: null, room: null, note: "Away" },
        { id: "x2", sessionId: "db", date: "2026-11-09", type: "moved", toDate: "2026-11-10", start: "11:00", end: "12:15", building: null, room: "300", note: "" },
      ],
      extras: [{ id: "m", courseCode: "DB", kind: "lecture", date: "2026-11-14", start: "10:00", end: "11:00", professor: "", building: "B", floor: "", room: "204", note: "Makeup" }],
    });
    const occ = classOccurrences(s, "2026-11-01", "2026-11-15");
    expect(occ.map((o) => [o.date, o.start, o.status])).toEqual([
      ["2026-11-02", "09:00", "scheduled"],
      ["2026-11-04", "09:00", "cancelled"],
      ["2026-11-10", "11:00", "scheduled"],
      ["2026-11-11", "09:00", "holiday"],
      ["2026-11-14", "10:00", "scheduled"],
    ]);
    const moved = occ[2];
    expect(moved).toMatchObject({ id: "db@2026-11-09", moved: true, originalDate: "2026-11-09", room: "300", building: "B" });
    expect(occ[4].makeup).toBe(true);
  });

  it("puts classes, tasks and events on one calendar", () => {
    const s = sched({
      sessions: [session("db", { days: [1] })],
      tasks: [task("a1", { dueDate: "2026-11-02", dueTime: "23:59" })],
      events: [
        { id: "e", title: "Study", category: "study", date: "2026-11-03", start: "19:00", end: "20:00", repeat: "weekly", until: "2026-11-17", location: "", courseCode: null, notes: "", url: "", inCalendar: true, source: "manual" },
        { id: "hidden", title: "Fair", category: "career-fair", date: "2026-11-04", start: null, end: null, repeat: "none", until: null, location: "", courseCode: null, notes: "", url: "", inCalendar: false, source: "sample" },
      ],
    });
    const items = agendaItems(s, "2026-11-02", "2026-11-10", title);
    expect(items.map((i) => `${i.kind}:${i.date}`)).toEqual(["class:2026-11-02", "task:2026-11-02", "event:2026-11-03", "class:2026-11-09", "event:2026-11-10"]);
    expect(agendaItems(s, "2026-11-04", "2026-11-04", title, { includeHidden: true }).map((i) => i.title)).toEqual(["Fair"]);
  });
});

describe("task priority", () => {
  const now = at("2026-11-09", 9 * 60);

  it("ranks a big assignment due tomorrow above a minor task in two weeks, and overdue first", () => {
    const ranked = rankTasks(
      [
        task("minor", { dueDate: "2026-11-23", weight: 2 }),
        task("big", { dueDate: "2026-11-10", weight: 20 }),
        task("late", { dueDate: "2026-11-08", weight: 5 }),
      ],
      now,
    );
    expect(ranked.map((r) => r.task.id)).toEqual(["late", "big", "minor"]);
    expect(ranked[0].overdue).toBe(true);
    expect(ranked[1].level).toBe("high");
    expect(ranked[2].level).toBe("low");
  });

  it("lets the student override the level", () => {
    const [r] = rankTasks([task("x", { dueDate: "2026-11-25", priority: "high" })], now);
    expect(r).toMatchObject({ level: "high", manual: true });
  });

  it("filters views and keeps completed tasks newest first", () => {
    const tasks = [
      task("today", { dueDate: "2026-11-09" }),
      task("week", { dueDate: "2026-11-13" }),
      task("late", { dueDate: "2026-11-01" }),
      task("doneOld", { done: true, completedAt: "2026-11-01T00:00:00Z" }),
      task("doneNew", { done: true, completedAt: "2026-11-08T00:00:00Z" }),
    ];
    expect(tasksForView(tasks, "today", now).map((r) => r.task.id)).toEqual(["today"]);
    expect(tasksForView(tasks, "week", now).map((r) => r.task.id).sort()).toEqual(["today", "week"]);
    expect(tasksForView(tasks, "overdue", now).map((r) => r.task.id)).toEqual(["late"]);
    expect(tasksForView(tasks, "completed", now).map((r) => r.task.id)).toEqual(["doneNew", "doneOld"]);
    expect(tasksForView(tasks, "all", now)).toHaveLength(3);
  });
});

describe("conflict detection", () => {
  const now = at("2026-11-02", 7 * 60);

  it("flags overlapping classes, and clears the alert once a class is rescheduled", () => {
    const overlapping = sched({ sessions: [session("a"), session("b", { start: "10:00", end: "11:15" })] });
    const alerts = detectConflicts(overlapping, settings(), now, title);
    const clash = alerts.filter((a) => a.rule === "class-overlap");
    expect(clash).toHaveLength(1);
    expect(clash[0].title).toBe("Two classes overlap on Mondays");
    expect(clash[0].why).toContain("15 minutes");
    expect(clash[0].affected.map((x) => x.id)).toEqual(["a", "b"]);

    const fixed = sched({ sessions: [session("a"), session("b", { start: "10:30", end: "11:45" })] });
    expect(detectConflicts(fixed, settings(), now, title).filter((a) => a.rule === "class-overlap")).toHaveLength(0);
  });

  it("warns about a tight change of building using the student's own travel time", () => {
    const s = sched({
      sessions: [session("a", { building: "B" }), session("b", { start: "10:20", end: "11:30", building: "C" })],
    });
    expect(detectConflicts(s, settings({ travelBufferMin: 10 }), now, title).some((a) => a.rule === "travel")).toBe(true);
    expect(detectConflicts(s, settings({ travelBufferMin: 5 }), now, title).some((a) => a.rule === "travel")).toBe(false);
    const sameBuilding = sched({ sessions: [session("a", { building: "B" }), session("b", { start: "10:20", end: "11:30", building: "b" })] });
    expect(detectConflicts(sameBuilding, settings(), now, title).some((a) => a.rule === "travel")).toBe(false);
  });

  it("finds exam clashes, back-to-back exams, deadline clusters and event clashes", () => {
    const s = sched({
      sessions: [session("cls", { days: [3], start: "14:00", end: "15:00" })],
      tasks: [
        task("m1", { type: "midterm", dueDate: "2026-11-05", dueTime: "10:00", durationMin: 90 }),
        task("m2", { type: "midterm", dueDate: "2026-11-05", dueTime: "11:00", durationMin: 60 }),
        task("q1", { type: "quiz", dueDate: "2026-11-06", dueTime: "09:00", durationMin: 30 }),
        task("q2", { type: "quiz", dueDate: "2026-11-06", dueTime: "10:00", durationMin: 30 }),
        task("a1", { dueDate: "2026-11-10", weight: 10 }),
        task("a2", { dueDate: "2026-11-10", weight: 20, effortHours: 6 }),
      ],
      events: [
        { id: "ev", title: "Club meeting", category: "club", date: "2026-11-04", start: "14:30", end: "15:30", repeat: "none", until: null, location: "", courseCode: null, notes: "", url: "", inCalendar: true, source: "manual" },
      ],
    });
    const alerts = detectConflicts(s, settings({ examGapMin: 60 }), now, title);
    const exam = alerts.filter((a) => a.rule === "exam-clash");
    expect(exam.map((a) => a.severity)).toEqual(["critical", "warning"]);
    const cluster = alerts.find((a) => a.rule === "deadline-cluster" && a.date === "2026-11-10")!;
    expect(cluster.action).toBe("Consider finishing a2 earlier.");
    expect(alerts.find((a) => a.rule === "event-class")!.why).toContain("Club meeting");
  });

  it("raises attendance and admin deadline alerts", () => {
    const s = sched({
      term: { name: "Fall", start: "2026-11-02", end: "2026-11-29", holidays: [] },
      sessions: [session("phy", { days: [1, 2, 3, 4, 5] })],
      attendance: { "phy@2026-11-02": "absent", "phy@2026-11-03": "absent", "phy@2026-11-04": "absent" },
      tasks: [task("reg", { type: "registration", dueDate: "2026-11-06" })],
    });
    const life = settings();
    life.attendance = { ...life.attendance, rule: "max-absences", maxAbsences: 4, warnAt: 1 };
    const alerts = detectConflicts(s, life, at("2026-11-05", 12 * 60), title);
    expect(alerts.find((a) => a.rule === "attendance")!.title).toBe("Attendance warning: 1 absence left in Course PHY");
    expect(alerts.find((a) => a.rule === "admin-deadline")!.title).toBe("reg closes tomorrow");
  });

  it("hides dismissed, resolved and snoozed alerts", () => {
    const alerts = detectConflicts(sched({ sessions: [session("a"), session("b", { start: "10:00", end: "11:15" })] }), settings(), now, title);
    const id = alerts[0].id;
    expect(visibleAlerts(alerts, { dismissed: [id], resolved: [], snoozed: {} }, new Date())).toHaveLength(0);
    expect(visibleAlerts(alerts, { dismissed: [], resolved: [], snoozed: { [id]: "2999-01-01T00:00:00Z" } }, new Date())).toHaveLength(0);
    expect(visibleAlerts(alerts, { dismissed: [], resolved: [], snoozed: { [id]: "2000-01-01T00:00:00Z" } }, new Date())).toHaveLength(1);
  });
});

describe("attendance", () => {
  const s = sched({
    term: { name: "Fall", start: "2026-11-02", end: "2026-11-29", holidays: [{ id: "h", name: "Holiday", start: "2026-11-16", end: "2026-11-16" }] },
    sessions: [session("os", { days: [1, 3] })],
    exceptions: [{ id: "c", sessionId: "os", date: "2026-11-18", type: "cancelled", toDate: null, start: null, end: null, building: null, room: null, note: "" }],
    attendance: { "os@2026-11-02": "present", "os@2026-11-04": "absent", "os@2026-11-09": "late", "os@2026-11-11": "excused" },
  });
  const now = at("2026-11-12", 8 * 60);

  it("counts held classes, skipping holidays, cancellations and excused absences", () => {
    const a = courseAttendance(s, settings(), "OS", now);
    expect(a.held).toHaveLength(4);
    expect(a.upcoming.map((o) => o.date)).toEqual(["2026-11-23", "2026-11-25"]);
    expect(a).toMatchObject({ present: 1, late: 1, absent: 1, excused: 1, countable: 3, attended: 2, percent: 66.7, risk: "no-rule" });
  });

  it("applies the student's rule and forecasts", () => {
    const life = settings();
    life.attendance = { ...life.attendance, rule: "min-percent", minPercent: 75, late: "absent" };
    const a = courseAttendance(s, life, "OS", now);
    // 6 meetings this semester, minus 1 excused = 5; 25% of 5 = 1.25 → 1 absence allowed; 2 taken.
    expect(a.allowedAbsences).toBe(1);
    expect(a.remainingAbsences).toBe(-1);
    expect(a.risk).toBe("exceeded");
    expect(percentIfMissNext(a)).toBe(25);
    expect(classesNeededFor(a, 50)).toBe(2);
    expect(classesNeededFor(a, 90)).toBeNull();
  });
});

describe("reminders and priorities", () => {
  const s = sched({
    sessions: [session("db", { days: [1], building: "B", room: "204" })],
    tasks: [task("hw", { dueDate: "2026-11-03", dueTime: "08:00" }), task("exam", { type: "final", dueDate: "2026-11-05", dueTime: "08:30" })],
  });

  it("fires reminders following the student's settings, and none when turned off", () => {
    const now = at("2026-11-02", 8 * 60 + 50);
    const ids = dueNotifications(s, settings(), now, [], title).map((n) => n.category);
    expect(ids).toEqual(expect.arrayContaining(["class", "assignment", "exam"]));
    const off = settings({ reminders: { classes: null, assignments: 60, exams: 60, deadlines: null, events: null } });
    expect(dueNotifications(s, off, now, [], title)).toHaveLength(0);
  });

  it("puts the next class and urgent deadlines first", () => {
    const now = at("2026-11-02", 8 * 60 + 50);
    const ranked = rankTasks(s.tasks, now);
    const occ = classOccurrences(s, now.date, now.date)[0];
    const list = todaysPriorities({ now, ranked, alerts: [], nextClass: { occurrence: occ, minutesUntil: 10 }, title });
    expect(list[0].title).toBe("Your next class begins in 10 min.");
    expect(list.some((p) => p.title === "hw due tomorrow at 8:00 AM.")).toBe(true);
  });
});

describe("GPA forecast", () => {
  const curriculum = getCurriculum("aau-bsc-software-engineering")!;
  const index = indexCurriculum(curriculum);
  const threeCredit = curriculum.courses.filter((c) => c.credits === 3 && !Object.values(DEMO_IN_PROGRESS).includes(c.code)).slice(0, 10).map((c) => c.code);
  const grades = Object.fromEntries(threeCredit.map((c, i) => [c, i < 7 ? "A" : "B"]));
  const input = (over: Partial<GradeInputs> = {}): GradeInputs => ({ index, completed: threeCredit, grades, attempts: [], gradeTerms: {}, scale: AAU_UNDERGRADUATE, ...over });
  const current = [DEMO_IN_PROGRESS.databases, DEMO_IN_PROGRESS.dataStructures, DEMO_IN_PROGRESS.requirements, DEMO_IN_PROGRESS.projectManagement];

  it("starts from a 3.70 CGPA over 30 credits", () => {
    expect(summarize(applyPolicy(rawEntries(input()), "all"))).toEqual({ gpa: 3.7, credits: 30, points: 111 });
  });

  it("predicts the CGPA from expected grades using real credit hours", () => {
    for (const c of current) expect(index.byCode.get(c)!.credits).toBe(3);
    const expected = { [current[0]]: "A", [current[1]]: "B+", [current[2]]: "B", [current[3]]: "A" };
    // (111 + 12 + 10.5 + 9 + 12) / 42 = 3.678…
    expect(forecastCgpa(input(), expected, "all")).toMatchObject({ cgpa: 3.68, semesterGpa: 3.63, credits: 42 });
  });

  it("works out the grades needed for a target", () => {
    const courses = current.map((code) => ({ code, credits: 3 }));
    const hard = requiredForTarget(input(), courses, 3.8, "all")!;
    expect(hard.achievable).toBe(false);
    const ok = requiredForTarget(input(), courses, 3.75, "all")!;
    expect(ok.achievable).toBe(true);
    expect(ok.uniformGrade?.symbol).toBe("A");
    expect(ok.neededAverage).toBeCloseTo(3.8575, 4);
    // Check: straight A's give 3.79, which reaches 3.75.
    expect(forecastCgpa(input(), Object.fromEntries(current.map((c) => [c, "A"])), "all").cgpa).toBe(3.79);
  });

  it("counts repeated courses by the chosen policy", () => {
    const retaken = threeCredit[9]; // final grade B
    const withFail = input({ attempts: [{ id: "f", code: retaken, grade: "F", semester: 1 }] });
    expect(summarize(applyPolicy(rawEntries(withFail), "all"))).toMatchObject({ credits: 33, gpa: 3.36 });
    expect(summarize(applyPolicy(rawEntries(withFail), "latest"))).toMatchObject({ credits: 30, gpa: 3.7 });
  });

  it("gives semester GPA and the CGPA after each semester", () => {
    const terms = Object.fromEntries(threeCredit.map((c, i) => [c, i < 5 ? 1 : 2]));
    const { semesters } = semesterHistory(rawEntries(input({ gradeTerms: terms })), "all");
    expect(semesters).toEqual([
      { semester: 1, sgpa: 4, credits: 15, cgpaAfter: 4 },
      { semester: 2, sgpa: 3.4, credits: 15, cgpaAfter: 3.7 },
    ]);
  });
});

describe("saved data isolation", () => {
  beforeEach(() => useAppStore.setState({ activeProfile: "personal", personal: null, demo: null }));

  it("keeps each major's and the demo's schedule separate", () => {
    const store = useAppStore.getState();
    store.startPersonal("aau", "aau-bsc-software-engineering");
    useAppStore.getState().saveTask(task("se-task"));
    useAppStore.getState().startPersonal("aau", "aau-bsc-computer-science");
    expect(scheduleOf(activeProfileOf(useAppStore.getState())).tasks).toHaveLength(0);
    useAppStore.getState().saveTask(task("cs-task"));
    useAppStore.getState().enterDemo();
    expect(scheduleOf(activeProfileOf(useAppStore.getState())).tasks.some((t) => t.id === "cs-task")).toBe(false);
    useAppStore.getState().exitDemo();
    useAppStore.getState().startPersonal("aau", "aau-bsc-software-engineering");
    expect(scheduleOf(activeProfileOf(useAppStore.getState())).tasks.map((t) => t.id)).toEqual(["se-task"]);
  });
});

describe("demo student", () => {
  it("has classes today, deadlines this week and conflicts to show", () => {
    const now = new Date();
    const profile = demoProfile(now);
    const s = profile.schedules["aau-bsc-software-engineering"];
    const today = zonedNow(now).date;
    const curriculum = getCurriculum("aau-bsc-software-engineering")!;
    for (const code of Object.values(DEMO_IN_PROGRESS)) expect(curriculum.courses.some((c) => c.code === code)).toBe(true);
    expect(classOccurrences(s, today, today).length).toBeGreaterThanOrEqual(3);
    expect(s.tasks.filter((t) => !t.done && t.dueDate >= today && t.dueDate <= addDays(today, 7)).length).toBeGreaterThanOrEqual(5);
    const rules = new Set(detectConflicts(s, profile.life, zonedNow(now), title).map((a) => a.rule));
    for (const rule of ["travel", "exam-clash", "deadline-cluster", "admin-deadline", "attendance"]) expect(rules).toContain(rule);
    expect(s.tasks.every((t) => t.source === "sample") && s.events.every((e) => e.source === "sample")).toBe(true);
  });
});
