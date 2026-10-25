"use client";

import { create } from "zustand";
import { getCurriculum } from "@/lib/curriculum/registry";
import type { Attempt } from "@/lib/gpa/forecast";
import {
  emptySchedule,
  type AttendanceMark,
  type BuildingNote,
  type CalendarEvent,
  type ClassException,
  type ExtraClass,
  type LifeSettings,
  type Schedule,
  type Session,
  type Task,
  type Term,
} from "@/lib/schedule/schema";
import { demoProfile, refreshDemo } from "./demo";
import { emptyProgress, emptyState, loadState, newProfile, saveState, type StorageLike } from "./persistence";
import { STORAGE_KEY, type CurriculumProgress, type PersistedState, type Preferences, type Profile } from "./schema";

export type ForecastScenario = "best" | "expected" | "worst";

interface ScheduleActions {
  setTerm(term: Term | null): void;
  saveSession(session: Session): void;
  deleteSession(id: string): void;
  /** One change per class meeting: saving replaces any earlier change to the same meeting. */
  saveException(exception: ClassException): void;
  deleteException(id: string): void;
  saveExtra(extra: ExtraClass): void;
  deleteExtra(id: string): void;
  saveTask(task: Task): void;
  deleteTask(id: string): void;
  setTaskDone(id: string, done: boolean): void;
  toggleSubtask(taskId: string, subtaskId: string): void;
  saveEvent(event: CalendarEvent): void;
  deleteEvent(id: string): void;
  setEventInCalendar(id: string, inCalendar: boolean): void;
  /** Null clears the mark. */
  markAttendance(occurrenceId: string, mark: AttendanceMark | null): void;
  dismissAlert(id: string): void;
  resolveAlert(id: string): void;
  snoozeAlert(id: string, until: string): void;
  restoreAlerts(): void;
  markNotificationsRead(ids: string[]): void;
  markDelivered(ids: string[]): void;
  saveBuilding(building: BuildingNote): void;
  deleteBuilding(id: string): void;
  /** Adds confirmed items from an import. */
  importItems(items: { tasks: Task[]; events: CalendarEvent[] }): void;
  updateLife(update: (life: LifeSettings) => LifeSettings): void;
  setGradeTerm(code: string, semester: number | null): void;
  saveAttempt(attempt: Attempt): void;
  deleteAttempt(id: string): void;
  setForecastGrade(scenario: ForecastScenario, code: string, grade: string | null): void;
}

interface Actions {
  dismissNotice(): void;
  /** Start (or switch to) a personal plan for a curriculum. Progress for other majors is kept separately. */
  startPersonal(universityId: string, curriculumId: string): void;
  setCompleted(codes: string[]): void;
  /** Returns true if the course is now completed. */
  toggleCompleted(code: string): boolean;
  /** Returns true if the course is now marked as taken this semester. */
  toggleInProgress(code: string): boolean;
  setInProgress(codes: string[]): void;
  /** Record a letter grade for a completed course (null clears it). */
  setGrade(code: string, grade: string | null): void;
  setNextSemester(ids: string[] | null): void;
  /** Pick an elective for a group. If `replaceId` is in the next-semester plan, the choice takes its place. */
  chooseElective(groupId: string, code: string, replaceId?: string): void;
  setPreferences(partial: Partial<Preferences>): void;
  enterDemo(): void;
  resetDemo(): void;
  exitDemo(): void;
  resetProgress(): void;
  /** Copy completed courses with identical codes from another major at the same university. */
  copyProgressFrom(curriculumId: string): number;
  replaceState(state: PersistedState): void;
}

export type AppStore = PersistedState & { notice: string | null } & Actions & ScheduleActions;

function browserStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function activeProfileOf(s: PersistedState): Profile | null {
  return s.activeProfile === "demo" ? s.demo : s.personal;
}

export function progressOf(profile: Profile | null): CurriculumProgress {
  return (profile && profile.progress[profile.curriculumId]) || emptyProgress();
}

function withActive(s: PersistedState, update: (p: Profile) => Profile): Partial<PersistedState> {
  const profile = activeProfileOf(s);
  if (!profile) return {};
  return s.activeProfile === "demo" ? { demo: update(profile) } : { personal: update(profile) };
}

function withProgress(
  s: PersistedState,
  update: (r: CurriculumProgress) => CurriculumProgress,
): Partial<PersistedState> {
  return withActive(s, (p) => ({
    ...p,
    progress: {
      ...p.progress,
      [p.curriculumId]: { ...update(progressOf(p)), updatedAt: new Date().toISOString() },
    },
  }));
}

export function scheduleOf(profile: Profile | null): Schedule {
  return (profile && profile.schedules[profile.curriculumId]) || emptySchedule();
}

function withSchedule(s: PersistedState, update: (sch: Schedule) => Schedule): Partial<PersistedState> {
  return withActive(s, (p) => ({ ...p, schedules: { ...p.schedules, [p.curriculumId]: update(scheduleOf(p)) } }));
}

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  return list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];
}

function withoutKeys(record: Record<string, string>, drop: (key: string) => boolean): Record<string, string> {
  return Object.fromEntries(Object.entries(record).filter(([k]) => !drop(k)));
}

/** Keeps the read/delivered lists from growing forever. */
function capped(list: string[], max = 600): string[] {
  return list.length > max ? list.slice(-max) : list;
}

const initial = typeof window === "undefined" ? { state: emptyState(), notice: null } : loadState(browserStorage());

export const useAppStore = create<AppStore>()((set, get) => ({
  ...initial.state,
  notice: initial.notice,

  dismissNotice: () => set({ notice: null }),

  startPersonal: (universityId, curriculumId) =>
    set((s) => {
      const existing = s.personal;
      const personal: Profile = existing
        ? { ...existing, universityId, curriculumId }
        : newProfile(universityId, curriculumId);
      return { personal, activeProfile: "personal" };
    }),

  setCompleted: (codes) =>
    set((s) =>
      withProgress(s, (r) => ({
        ...r,
        completed: [...new Set(codes)],
        inProgress: r.inProgress.filter((c) => !codes.includes(c)),
        nextSemester: r.nextSemester?.filter((id) => !codes.includes(id)) ?? null,
      })),
    ),

  toggleCompleted: (code) => {
    const current = progressOf(activeProfileOf(get()));
    const nowCompleted = !current.completed.includes(code);
    set((s) =>
      withProgress(s, (r) => ({
        ...r,
        completed: nowCompleted ? [...r.completed, code] : r.completed.filter((c) => c !== code),
        // A course is either finished or being taken, never both.
        inProgress: nowCompleted ? r.inProgress.filter((c) => c !== code) : r.inProgress,
        nextSemester: nowCompleted ? (r.nextSemester?.filter((id) => id !== code) ?? null) : r.nextSemester,
      })),
    );
    return nowCompleted;
  },

  toggleInProgress: (code) => {
    const current = progressOf(activeProfileOf(get()));
    const nowTaking = !current.inProgress.includes(code);
    set((s) =>
      withProgress(s, (r) => ({
        ...r,
        inProgress: nowTaking ? [...r.inProgress, code] : r.inProgress.filter((c) => c !== code),
        completed: nowTaking ? r.completed.filter((c) => c !== code) : r.completed,
        nextSemester: nowTaking ? (r.nextSemester?.filter((id) => id !== code) ?? null) : r.nextSemester,
      })),
    );
    return nowTaking;
  },

  setInProgress: (codes) =>
    set((s) =>
      withProgress(s, (r) => {
        const unique = [...new Set(codes)];
        return {
          ...r,
          inProgress: unique,
          completed: r.completed.filter((c) => !unique.includes(c)),
          nextSemester: r.nextSemester?.filter((id) => !unique.includes(id)) ?? null,
        };
      }),
    ),

  setGrade: (code, grade) =>
    set((s) =>
      withProgress(s, (r) => {
        const grades = { ...r.grades };
        if (grade) grades[code] = grade;
        else delete grades[code];
        return { ...r, grades };
      }),
    ),

  setNextSemester: (ids) => set((s) => withProgress(s, (r) => ({ ...r, nextSemester: ids ? [...new Set(ids)] : null }))),

  chooseElective: (groupId, code, replaceId) =>
    set((s) =>
      withProgress(s, (r) => {
        const choices = r.electiveChoices[groupId] ?? [];
        return {
          ...r,
          electiveChoices: { ...r.electiveChoices, [groupId]: choices.includes(code) ? choices : [...choices, code] },
          nextSemester:
            r.nextSemester && replaceId && r.nextSemester.includes(replaceId)
              ? r.nextSemester.map((id) => (id === replaceId ? code : id))
              : r.nextSemester,
        };
      }),
    ),

  setPreferences: (partial) => set((s) => withActive(s, (p) => ({ ...p, preferences: { ...p.preferences, ...partial } }))),

  enterDemo: () => set((s) => ({ demo: s.demo ? refreshDemo(s.demo) : demoProfile(), activeProfile: "demo" })),
  resetDemo: () => set({ demo: demoProfile(), activeProfile: "demo" }),
  exitDemo: () => set({ activeProfile: "personal" }),

  resetProgress: () => set((s) => withProgress(s, () => emptyProgress())),

  copyProgressFrom: (curriculumId) => {
    const profile = activeProfileOf(get());
    const target = getCurriculum(profile?.curriculumId);
    const source = profile?.progress[curriculumId];
    if (!profile || !target || !source) return 0;
    const codes = new Set(target.courses.map((c) => c.code));
    const current = progressOf(profile).completed;
    const copied = source.completed.filter((c) => codes.has(c) && !current.includes(c));
    get().setCompleted([...current, ...copied]);
    return copied.length;
  },

  replaceState: (state) => set({ ...state, notice: null }),

  setTerm: (term) => set((s) => withSchedule(s, (sch) => ({ ...sch, term }))),
  saveSession: (session) => set((s) => withSchedule(s, (sch) => ({ ...sch, sessions: upsert(sch.sessions, session) }))),
  deleteSession: (id) =>
    set((s) =>
      withSchedule(s, (sch) => ({
        ...sch,
        sessions: sch.sessions.filter((x) => x.id !== id),
        exceptions: sch.exceptions.filter((x) => x.sessionId !== id),
        attendance: withoutKeys(sch.attendance, (k) => k.startsWith(`${id}@`)) as Schedule["attendance"],
      })),
    ),
  saveException: (exception) =>
    set((s) =>
      withSchedule(s, (sch) => ({
        ...sch,
        exceptions: [
          ...sch.exceptions.filter(
            (x) => x.id !== exception.id && !(x.sessionId === exception.sessionId && x.date === exception.date),
          ),
          exception,
        ],
      })),
    ),
  deleteException: (id) => set((s) => withSchedule(s, (sch) => ({ ...sch, exceptions: sch.exceptions.filter((x) => x.id !== id) }))),
  saveExtra: (extra) => set((s) => withSchedule(s, (sch) => ({ ...sch, extras: upsert(sch.extras, extra) }))),
  deleteExtra: (id) =>
    set((s) =>
      withSchedule(s, (sch) => ({
        ...sch,
        extras: sch.extras.filter((x) => x.id !== id),
        attendance: withoutKeys(sch.attendance, (k) => k === `extra:${id}`) as Schedule["attendance"],
      })),
    ),
  saveTask: (task) => set((s) => withSchedule(s, (sch) => ({ ...sch, tasks: upsert(sch.tasks, task) }))),
  deleteTask: (id) => set((s) => withSchedule(s, (sch) => ({ ...sch, tasks: sch.tasks.filter((x) => x.id !== id) }))),
  setTaskDone: (id, done) =>
    set((s) =>
      withSchedule(s, (sch) => ({
        ...sch,
        tasks: sch.tasks.map((t) => (t.id === id ? { ...t, done, completedAt: done ? new Date().toISOString() : null } : t)),
      })),
    ),
  toggleSubtask: (taskId, subtaskId) =>
    set((s) =>
      withSchedule(s, (sch) => ({
        ...sch,
        tasks: sch.tasks.map((t) =>
          t.id === taskId ? { ...t, subtasks: t.subtasks.map((st) => (st.id === subtaskId ? { ...st, done: !st.done } : st)) } : t,
        ),
      })),
    ),
  saveEvent: (event) => set((s) => withSchedule(s, (sch) => ({ ...sch, events: upsert(sch.events, event) }))),
  deleteEvent: (id) => set((s) => withSchedule(s, (sch) => ({ ...sch, events: sch.events.filter((x) => x.id !== id) }))),
  setEventInCalendar: (id, inCalendar) =>
    set((s) => withSchedule(s, (sch) => ({ ...sch, events: sch.events.map((e) => (e.id === id ? { ...e, inCalendar } : e)) }))),
  markAttendance: (occurrenceId, mark) =>
    set((s) =>
      withSchedule(s, (sch) => {
        const attendance = { ...sch.attendance };
        if (mark) attendance[occurrenceId] = mark;
        else delete attendance[occurrenceId];
        return { ...sch, attendance };
      }),
    ),
  dismissAlert: (id) =>
    set((s) => withSchedule(s, (sch) => ({ ...sch, alerts: { ...sch.alerts, dismissed: capped([...sch.alerts.dismissed, id]) } }))),
  resolveAlert: (id) =>
    set((s) => withSchedule(s, (sch) => ({ ...sch, alerts: { ...sch.alerts, resolved: capped([...sch.alerts.resolved, id]) } }))),
  snoozeAlert: (id, until) =>
    set((s) =>
      withSchedule(s, (sch) => ({ ...sch, alerts: { ...sch.alerts, snoozed: { ...sch.alerts.snoozed, [id]: until } } })),
    ),
  restoreAlerts: () => set((s) => withSchedule(s, (sch) => ({ ...sch, alerts: { dismissed: [], resolved: [], snoozed: {} } }))),
  markNotificationsRead: (ids) =>
    set((s) =>
      withSchedule(s, (sch) => ({
        ...sch,
        notifications: { ...sch.notifications, read: capped([...new Set([...sch.notifications.read, ...ids])]) },
      })),
    ),
  markDelivered: (ids) =>
    set((s) =>
      withSchedule(s, (sch) => ({
        ...sch,
        notifications: { ...sch.notifications, delivered: capped([...new Set([...sch.notifications.delivered, ...ids])]) },
      })),
    ),
  saveBuilding: (building) => set((s) => withSchedule(s, (sch) => ({ ...sch, buildings: upsert(sch.buildings, building) }))),
  deleteBuilding: (id) => set((s) => withSchedule(s, (sch) => ({ ...sch, buildings: sch.buildings.filter((b) => b.id !== id) }))),
  importItems: ({ tasks, events }) =>
    set((s) => withSchedule(s, (sch) => ({ ...sch, tasks: [...sch.tasks, ...tasks], events: [...sch.events, ...events] }))),
  updateLife: (update) => set((s) => withActive(s, (p) => ({ ...p, life: update(p.life) }))),
  setGradeTerm: (code, semester) =>
    set((s) =>
      withProgress(s, (r) => {
        const gradeTerms = { ...r.gradeTerms };
        if (semester) gradeTerms[code] = semester;
        else delete gradeTerms[code];
        return { ...r, gradeTerms };
      }),
    ),
  saveAttempt: (attempt) => set((s) => withProgress(s, (r) => ({ ...r, attempts: upsert(r.attempts, attempt) }))),
  deleteAttempt: (id) => set((s) => withProgress(s, (r) => ({ ...r, attempts: r.attempts.filter((a) => a.id !== id) }))),
  setForecastGrade: (scenario, code, grade) =>
    set((s) =>
      withProgress(s, (r) => {
        const scenarioGrades = { ...r.forecast[scenario] };
        if (grade) scenarioGrades[code] = grade;
        else delete scenarioGrades[code];
        return { ...r, forecast: { ...r.forecast, [scenario]: scenarioGrades } };
      }),
    ),
}));

if (typeof window !== "undefined") {
  useAppStore.subscribe((s) => {
    const { version, activeProfile, personal, demo } = s;
    saveState(browserStorage(), { version, activeProfile, personal, demo });
  });
  // Keep tabs in sync.
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    const { state } = loadState(browserStorage());
    useAppStore.setState(state);
  });
}
