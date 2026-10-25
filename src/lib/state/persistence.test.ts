import { describe, expect, it } from "vitest";
import { getCurriculum } from "@/lib/curriculum/registry";
import { computePlan } from "@/lib/plan";
import { DEMO_COMPLETED, DEMO_CURRICULUM_ID, demoProfile } from "./demo";
import {
  emptyState,
  exportState,
  importState,
  loadState,
  newProfile,
  parseStoredState,
  saveState,
  type StorageLike,
} from "./persistence";
import { BACKUP_PREFIX, STORAGE_KEY, type PersistedState } from "./schema";

class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

const sampleState = (): PersistedState => {
  const personal = newProfile("aau", "aau-bsc-computer-science", new Date(2026, 9, 25));
  personal.progress["aau-bsc-computer-science"] = {
    completed: ["0102120", "0107101"],
    nextSemester: null,
    electiveChoices: {},
    updatedAt: "2026-10-25T00:00:00.000Z",
  };
  return { ...emptyState(), personal };
};

describe("persistence", () => {
  it("round-trips saved state", () => {
    const storage = new MemoryStorage();
    const state = sampleState();
    expect(saveState(storage, state)).toBe(true);
    const loaded = loadState(storage);
    expect(loaded.state).toEqual(state);
    expect(loaded.notice).toBeNull();
  });

  it("starts empty when nothing is saved", () => {
    expect(parseStoredState(null)).toEqual({ state: emptyState(), notice: null, backup: null });
  });

  it("keeps a backup when saved data is corrupted", () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, "{not json");
    const loaded = loadState(storage, new Date("2026-10-25T10:00:00Z"));
    expect(loaded.state).toEqual(emptyState());
    expect(loaded.notice).toMatch(/backup/);
    expect(storage.getItem(`${BACKUP_PREFIX}2026-10-25T10:00:00.000Z`)).toBe("{not json");
  });

  it("rejects data that doesn't match the schema, keeping a backup", () => {
    const bad = JSON.stringify({ version: 1, activeProfile: "personal", personal: { curriculumId: 5 }, demo: null });
    const result = parseStoredState(bad);
    expect(result.state).toEqual(emptyState());
    expect(result.backup).toBe(bad);
  });

  it("does not load data from a newer version", () => {
    const result = parseStoredState(JSON.stringify({ ...sampleState(), version: 99 }));
    expect(result.notice).toMatch(/newer version/);
    expect(result.backup).not.toBeNull();
  });

  it("keeps progress for a major that no longer exists, with a notice", () => {
    const state = sampleState();
    state.personal!.curriculumId = "retired-major";
    const result = parseStoredState(JSON.stringify(state));
    expect(result.state.personal?.curriculumId).toBe("retired-major");
    expect(result.notice).toMatch(/isn't available/);
  });

  it("rejects out-of-range planning preferences", () => {
    const state = sampleState();
    state.personal!.preferences.maxCredits = 40;
    expect(parseStoredState(JSON.stringify(state)).backup).not.toBeNull();
  });

  it("exports and imports", () => {
    const state = sampleState();
    const result = importState(exportState(state));
    expect(result).toEqual({ state });
    expect(importState("nope")).toHaveProperty("error");
    expect(importState(JSON.stringify({ version: 1 }))).toHaveProperty("error");
  });
});

describe("demo student", () => {
  it("uses real curriculum data and real planning logic", () => {
    const profile = demoProfile(new Date(2026, 9, 25));
    expect(profile.curriculumId).toBe(DEMO_CURRICULUM_ID);
    const curriculum = getCurriculum(DEMO_CURRICULUM_ID)!;
    const codes = new Set(curriculum.courses.map((c) => c.code));
    expect(DEMO_COMPLETED.every((c) => codes.has(c))).toBe(true);

    const view = computePlan(curriculum, profile.progress[DEMO_CURRICULUM_ID], profile.preferences);
    expect(view.progress.countedCredits).toBe(49);
    expect(view.roadmap.blocked).toBeNull();
    expect(view.nextItems.length).toBeGreaterThan(0);
    expect(view.insight).not.toBeNull();
    expect(view.roadmap.semesters[0].label).toBe("Spring 2027");
  });

  it("warns when a custom next semester delays graduation", () => {
    const profile = demoProfile(new Date(2026, 9, 25));
    const curriculum = getCurriculum(DEMO_CURRICULUM_ID)!;
    const record = { ...profile.progress[DEMO_CURRICULUM_ID], nextSemester: ["0406110"] };
    const view = computePlan(curriculum, record, profile.preferences);
    expect(view.customDelay).not.toBeNull();
    expect(view.customDelay!.reason).toMatch(/can't start until it's done/);
  });
});
