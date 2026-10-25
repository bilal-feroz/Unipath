import { agendaItems, type CourseTitle } from "./agenda";
import type { Alert, AlertRule } from "./conflicts";
import { classOccurrences, locationLine } from "./occurrences";
import { ADMIN_TYPES, EXAM_TYPES, type LifeSettings, type Schedule } from "./schema";
import {
  addDays,
  formatDate,
  formatDuration,
  formatTime,
  minutesUntil,
  toMinutes,
  type DateStr,
  type TimeStr,
  type ZonedNow,
} from "./time";

export type NotificationCategory =
  | "class"
  | "assignment"
  | "exam"
  | "deadline"
  | "event"
  | "timetable"
  | "attendance"
  | "conflict"
  | "travel";

export interface AppNotification {
  /** Stable per reminder, so read state and browser delivery are tracked once. */
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  href: string;
  /** When the thing it's about happens, for ordering. */
  date: DateStr;
  time: TimeStr | null;
  urgent: boolean;
}

const ALERT_CATEGORY: Record<AlertRule, NotificationCategory> = {
  "class-overlap": "conflict",
  "exam-clash": "conflict",
  "deadline-cluster": "conflict",
  "event-class": "conflict",
  travel: "travel",
  attendance: "attendance",
  "admin-deadline": "deadline",
};

function when(minutes: number): string {
  if (minutes < 0) return `${formatDuration(-minutes)} ago`;
  return minutes < 1 ? "now" : `in ${formatDuration(minutes)}`;
}

/**
 * Notifications that are due now, following the student's reminder settings: reminders before classes,
 * deadlines, exams and events, timetable changes for the coming week, and open alerts.
 */
export function dueNotifications(
  schedule: Schedule,
  settings: LifeSettings,
  now: ZonedNow,
  alerts: Alert[],
  title: CourseTitle,
): AppNotification[] {
  const out: AppNotification[] = [];
  const r = settings.reminders;
  const items = agendaItems(schedule, addDays(now.date, -1), addDays(now.date, 15), title);

  for (const item of items) {
    if (item.inactive) continue;
    if (item.kind === "class") {
      if (r.classes === null || !item.start || !item.end) continue;
      const until = minutesUntil(now, item.date, item.start);
      const length = toMinutes(item.end) - toMinutes(item.start);
      if (until > r.classes || until < -length) continue;
      out.push({
        id: `class:${item.ref.id}:${r.classes}`,
        category: "class",
        title: until > 0 ? `${item.title} starts ${when(until)}` : `${item.title} is on now`,
        body: [formatTime(item.start), item.location].filter(Boolean).join(" · "),
        href: "/campus",
        date: item.date,
        time: item.start,
        urgent: until <= 15,
      });
    } else if (item.kind === "task" && item.task) {
      const t = item.task;
      const exam = EXAM_TYPES.has(t.type);
      const offset = exam ? r.exams : ADMIN_TYPES.has(t.type) ? r.deadlines : r.assignments;
      if (offset === null) continue;
      const until = minutesUntil(now, t.dueDate, t.dueTime);
      if (until > offset || until < -24 * 60) continue;
      out.push({
        id: `task:${t.id}:${t.dueDate}:${t.dueTime ?? ""}:${offset}`,
        category: exam ? "exam" : ADMIN_TYPES.has(t.type) ? "deadline" : "assignment",
        title: until < 0 ? `${t.title} is overdue` : `${t.title} ${exam ? "starts" : "is due"} ${when(until)}`,
        body: `${formatDate(t.dueDate)}${t.dueTime ? ` at ${formatTime(t.dueTime)}` : ""}${item.note ? ` · ${item.note}` : ""}`,
        href: "/tasks",
        date: t.dueDate,
        time: t.dueTime,
        urgent: until < 24 * 60,
      });
    } else if (item.kind === "event" && item.event) {
      if (r.events === null) continue;
      const until = minutesUntil(now, item.date, item.start ?? "00:00");
      if (until > r.events || until < -60) continue;
      out.push({
        id: `event:${item.id}:${r.events}`,
        category: "event",
        title: `${item.title} ${item.start ? when(until) : formatDate(item.date) === formatDate(now.date) ? "today" : formatDate(item.date)}`,
        body: [item.start ? formatTime(item.start) : "All day", item.location].filter(Boolean).join(" · "),
        href: "/calendar",
        date: item.date,
        time: item.start,
        urgent: false,
      });
    }
  }

  // Timetable changes in the next week.
  for (const o of classOccurrences(schedule, now.date, addDays(now.date, 7))) {
    if (o.status === "cancelled" || o.moved) {
      out.push({
        id: `timetable:${o.id}:${o.status}:${o.date}:${o.start}`,
        category: "timetable",
        title: o.status === "cancelled" ? `${title(o.courseCode)} is cancelled on ${formatDate(o.date)}` : `${title(o.courseCode)} has moved`,
        body:
          o.status === "cancelled"
            ? o.note || "No class that day."
            : `Now ${formatDate(o.date)} at ${formatTime(o.start)}${locationLine(o) ? ` · ${locationLine(o)}` : ""}`,
        href: "/timetable",
        date: o.date,
        time: o.start,
        urgent: false,
      });
    }
  }

  for (const a of alerts) {
    out.push({
      id: `alert:${a.id}`,
      category: ALERT_CATEGORY[a.rule],
      title: a.title,
      body: a.action,
      href: a.href,
      date: a.date ?? now.date,
      time: null,
      urgent: a.severity === "critical",
    });
  }

  const seen = new Set<string>();
  return out
    .filter((n) => (seen.has(n.id) ? false : (seen.add(n.id), true)))
    .sort((a, b) => Number(b.urgent) - Number(a.urgent) || a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));
}
