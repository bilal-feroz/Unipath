import type { Alert } from "./conflicts";
import type { ClassOccurrence } from "./occurrences";
import { locationLine } from "./occurrences";
import { EXAM_TYPES } from "./schema";
import type { RankedTask } from "./tasks";
import { addDays, formatDuration, formatTime, relativeDay, type ZonedNow } from "./time";

export interface PriorityItem {
  id: string;
  kind: "class" | "task" | "alert";
  title: string;
  detail: string;
  level: "critical" | "high" | "medium" | "low";
  score: number;
  href: string;
}

function dueLabel(r: RankedTask, now: ZonedNow): string {
  const t = r.task;
  if (r.overdue) return `was due ${relativeDay(t.dueDate, now.date)}`;
  const day = relativeDay(t.dueDate, now.date);
  const at = t.dueTime ? ` at ${formatTime(t.dueTime)}` : "";
  return EXAM_TYPES.has(t.type) ? `${day}${at}` : `due ${day}${at}`;
}

/**
 * The few things that need attention today, most important first: the next class if it's soon,
 * deadlines and exams in the coming week, and open alerts.
 */
export function todaysPriorities({
  now,
  ranked,
  alerts,
  nextClass,
  title,
  limit = 6,
}: {
  now: ZonedNow;
  ranked: RankedTask[];
  alerts: Alert[];
  nextClass: { occurrence: ClassOccurrence; minutesUntil: number } | null;
  title: (code: string) => string;
  limit?: number;
}): PriorityItem[] {
  const out: PriorityItem[] = [];

  if (nextClass && nextClass.minutesUntil <= 120) {
    const o = nextClass.occurrence;
    const m = nextClass.minutesUntil;
    out.push({
      id: `class:${o.id}`,
      kind: "class",
      title: m <= 0 ? `${title(o.courseCode)} has started.` : `Your next class begins in ${formatDuration(m)}.`,
      detail: [title(o.courseCode), locationLine(o)].filter(Boolean).join(" · "),
      level: m <= 15 ? "critical" : "high",
      score: m <= 15 ? 96 : m <= 60 ? 85 : 60,
      href: "/campus",
    });
  }

  const weekEnd = addDays(now.date, 7);
  const listedTasks = new Set<string>();
  for (const r of ranked) {
    if (r.task.done || (!r.overdue && r.task.dueDate > weekEnd)) continue;
    listedTasks.add(r.task.id);
    out.push({
      id: `task:${r.task.id}`,
      kind: "task",
      title: `${r.task.title} ${dueLabel(r, now)}.`,
      detail: r.why.join(" · "),
      level: r.overdue ? "critical" : r.level,
      score: r.score,
      href: "/tasks",
    });
  }

  for (const a of alerts) {
    if (a.rule === "admin-deadline" && a.affected.every((x) => listedTasks.has(x.id))) continue;
    out.push({
      id: `alert:${a.id}`,
      kind: "alert",
      title: a.title,
      detail: a.action,
      level: a.severity === "critical" ? "critical" : a.severity === "warning" ? "high" : "medium",
      score: a.severity === "critical" ? 92 : a.severity === "warning" ? 70 : 35,
      href: a.href,
    });
  }

  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}
