import { ADMIN_TYPES, EXAM_TYPES, type Task, type TaskType } from "./schema";
import { addDays, minutesUntil, type DateStr, type ZonedNow } from "./time";

export type PriorityLevel = "high" | "medium" | "low";

/** Typical share of a course grade, used only when the student hasn't entered a weight. */
const TYPICAL_WEIGHT: Record<TaskType, number> = {
  final: 30,
  midterm: 20,
  exam: 20,
  project: 15,
  registration: 15,
  payment: 15,
  assignment: 10,
  presentation: 10,
  admin: 10,
  quiz: 5,
  lab: 5,
  other: 5,
};

export interface RankedTask {
  task: Task;
  /** Higher = needs attention sooner. */
  score: number;
  level: PriorityLevel;
  /** True when the student set the level themselves. */
  manual: boolean;
  /** Plain-language reasons for the ranking. */
  why: string[];
  minutesLeft: number;
  overdue: boolean;
  progress: number;
}

export function taskProgress(task: Task): number {
  if (task.done) return 100;
  if (task.subtasks.length > 0) return Math.round((task.subtasks.filter((s) => s.done).length / task.subtasks.length) * 100);
  return task.progress;
}

function urgency(hoursLeft: number): number {
  if (hoursLeft < 0) return 100;
  if (hoursLeft <= 12) return 95;
  if (hoursLeft <= 24) return 90;
  if (hoursLeft <= 36) return 82;
  if (hoursLeft <= 48) return 75;
  if (hoursLeft <= 72) return 62;
  if (hoursLeft <= 5 * 24) return 48;
  if (hoursLeft <= 7 * 24) return 38;
  if (hoursLeft <= 14 * 24) return 20;
  return 8;
}

/**
 * Ranks a task by (1) how close the deadline is, (2) the work left, (3) how much it's worth,
 * (4) how far along it is, and (5) whether it clashes with other deadlines that day.
 * A level the student chose themselves always wins.
 */
export function rankTask(task: Task, now: ZonedNow, busyDays: ReadonlySet<DateStr> = new Set()): RankedTask {
  const minutesLeft = minutesUntil(now, task.dueDate, task.dueTime);
  const progress = taskProgress(task);
  const why: string[] = [];
  if (task.done) {
    return { task, score: -1, level: "low", manual: task.priority !== "auto", why: ["Done"], minutesLeft, overdue: false, progress };
  }
  const hoursLeft = minutesLeft / 60;
  let score = urgency(hoursLeft);
  if (hoursLeft < 0) why.push("Overdue");
  else if (hoursLeft <= 48) why.push("Due very soon");

  const weight = task.weight ?? TYPICAL_WEIGHT[task.type];
  score += (weight / 100) * 60;
  if (task.weight !== null && task.weight >= 15) why.push(`Worth ${task.weight}% of the grade`);
  else if (EXAM_TYPES.has(task.type)) why.push("Exam");
  else if (ADMIN_TYPES.has(task.type)) why.push("Administrative deadline");

  if (task.effortHours && hoursLeft >= 0 && hoursLeft < task.effortHours * 4) {
    score += 15;
    why.push(`About ${task.effortHours} h of work left`);
  }
  // Work already done lowers the urgency, but a deadline is still a deadline.
  score *= 0.6 + 0.4 * (1 - progress / 100);
  if (busyDays.has(task.dueDate)) {
    score += 8;
    why.push("Other deadlines the same day");
  }

  const auto: PriorityLevel = score >= 75 ? "high" : score >= 40 ? "medium" : "low";
  const manual = task.priority !== "auto";
  const level = manual ? (task.priority as PriorityLevel) : auto;
  // A manual level moves the task within the list as well as labelling it.
  if (manual) score += level === "high" ? 40 : level === "low" ? -40 : 0;
  return { task, score, level, manual, why, minutesLeft, overdue: hoursLeft < 0, progress };
}

/** Dates with at least `threshold` open, non-trivial deadlines. */
export function busyDates(tasks: Task[], threshold: number): Set<DateStr> {
  const count = new Map<DateStr, number>();
  for (const t of tasks) {
    if (t.done || t.type === "other") continue;
    count.set(t.dueDate, (count.get(t.dueDate) ?? 0) + 1);
  }
  return new Set([...count].filter(([, n]) => n >= threshold).map(([d]) => d));
}

export function rankTasks(tasks: Task[], now: ZonedNow, threshold = 2): RankedTask[] {
  const busy = busyDates(tasks, threshold);
  return tasks
    .map((t) => rankTask(t, now, busy))
    .sort((a, b) => b.score - a.score || a.minutesLeft - b.minutesLeft || a.task.title.localeCompare(b.task.title));
}

export type TaskView = "all" | "today" | "week" | "overdue" | "completed";

export function inView(r: RankedTask, view: TaskView, now: ZonedNow): boolean {
  const t = r.task;
  switch (view) {
    case "all":
      return !t.done;
    case "completed":
      return t.done;
    case "overdue":
      return !t.done && r.overdue;
    case "today":
      return !t.done && t.dueDate === now.date;
    case "week":
      return !t.done && t.dueDate >= now.date && t.dueDate <= addDays(now.date, 6);
  }
}

/** Tasks for a view, best first; completed tasks newest first. */
export function tasksForView(tasks: Task[], view: TaskView, now: ZonedNow, threshold = 2): RankedTask[] {
  const ranked = rankTasks(tasks, now, threshold).filter((r) => inView(r, view, now));
  if (view === "completed") ranked.sort((a, b) => (b.task.completedAt ?? "").localeCompare(a.task.completedAt ?? ""));
  return ranked;
}
