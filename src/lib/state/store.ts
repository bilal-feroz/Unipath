"use client";

import { create } from "zustand";
import { getCurriculum } from "@/lib/curriculum/registry";
import { demoProfile, withDemoGrades } from "./demo";
import { emptyProgress, emptyState, loadState, newProfile, saveState, type StorageLike } from "./persistence";
import { STORAGE_KEY, type CurriculumProgress, type PersistedState, type Preferences, type Profile } from "./schema";

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

export type AppStore = PersistedState & { notice: string | null } & Actions;

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

  enterDemo: () => set((s) => ({ demo: s.demo ? withDemoGrades(s.demo) : demoProfile(), activeProfile: "demo" })),
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
