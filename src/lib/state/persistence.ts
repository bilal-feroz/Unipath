import { getCurriculum } from "@/lib/curriculum/registry";
import { DEFAULT_SETTINGS } from "@/lib/engine/scheduler";
import { defaultStartTerm } from "@/lib/engine/terms";
import {
  BACKUP_PREFIX,
  persistedStateSchema,
  STATE_VERSION,
  STORAGE_KEY,
  type CurriculumProgress,
  type PersistedState,
  type Preferences,
  type Profile,
} from "./schema";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function emptyState(): PersistedState {
  return { version: STATE_VERSION, activeProfile: "personal", personal: null, demo: null };
}

export function defaultPreferences(now: Date = new Date()): Preferences {
  return { ...DEFAULT_SETTINGS, startTerm: defaultStartTerm(now) };
}

export function emptyProgress(): CurriculumProgress {
  return { completed: [], nextSemester: null, electiveChoices: {}, updatedAt: new Date(0).toISOString() };
}

export interface ParseResult {
  state: PersistedState;
  /** A message for the student when saved data couldn't be used as-is. */
  notice: string | null;
  /** The original text, kept when it couldn't be read, so nothing is silently lost. */
  backup: string | null;
}

const UNREADABLE =
  "We couldn't read your saved progress, so UniPath started fresh. A backup copy was kept in this browser.";

/** Older versions are upgraded here. There is only one version so far. */
function migrate(data: unknown): unknown {
  return data;
}

/** Turns stored text into valid state. Never throws, never discards data without keeping a backup. */
export function parseStoredState(raw: string | null): ParseResult {
  if (raw === null || raw === "") return { state: emptyState(), notice: null, backup: null };

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { state: emptyState(), notice: UNREADABLE, backup: raw };
  }

  const version = (data as { version?: unknown })?.version;
  if (typeof version === "number" && version > STATE_VERSION) {
    return {
      state: emptyState(),
      notice: "Your progress was saved by a newer version of UniPath. A backup copy was kept in this browser.",
      backup: raw,
    };
  }

  const parsed = persistedStateSchema.safeParse(migrate(data));
  if (!parsed.success) return { state: emptyState(), notice: UNREADABLE, backup: raw };

  const state = parsed.data;
  const missing = [state.personal, state.demo].some((p) => p && !getCurriculum(p.curriculumId));
  return {
    state,
    notice: missing
      ? "Your saved major isn't available in this version of UniPath. Your progress is still saved — choose a major to continue."
      : null,
    backup: null,
  };
}

export function loadState(storage: StorageLike | null, now: Date = new Date()): { state: PersistedState; notice: string | null } {
  if (!storage) return { state: emptyState(), notice: null };
  let raw: string | null = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { state: emptyState(), notice: "This browser is blocking saved data, so your progress won't be kept after you leave." };
  }
  const result = parseStoredState(raw);
  if (result.backup !== null) {
    try {
      storage.setItem(`${BACKUP_PREFIX}${now.toISOString()}`, result.backup);
    } catch {
      // Storage is full or blocked; the notice still tells the student what happened.
    }
  }
  return { state: result.state, notice: result.notice };
}

export function saveState(storage: StorageLike | null, state: PersistedState): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function exportState(state: PersistedState): string {
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString(), app: "UniPath" }, null, 2);
}

/** Validates an exported file before it replaces anything. */
export function importState(text: string): { state: PersistedState } | { error: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: "That file isn't a UniPath export (it isn't valid JSON)." };
  }
  if (data && typeof data === "object") {
    delete (data as Record<string, unknown>).exportedAt;
    delete (data as Record<string, unknown>).app;
  }
  const version = (data as { version?: unknown })?.version;
  if (typeof version === "number" && version > STATE_VERSION) {
    return { error: "That file was made by a newer version of UniPath." };
  }
  const parsed = persistedStateSchema.safeParse(migrate(data));
  if (!parsed.success) return { error: "That file isn't a valid UniPath export." };
  for (const profile of [parsed.data.personal, parsed.data.demo]) {
    if (profile && !getCurriculum(profile.curriculumId)) {
      return { error: "That file uses a major that isn't available in this version of UniPath." };
    }
  }
  return { state: parsed.data };
}

export function newProfile(universityId: string, curriculumId: string, now: Date = new Date()): Profile {
  return { universityId, curriculumId, progress: {}, preferences: defaultPreferences(now) };
}
