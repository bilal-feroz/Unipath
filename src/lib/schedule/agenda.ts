import { classOccurrences, locationLine, type ClassOccurrence } from "./occurrences";
import { TIMED_TYPES, type CalendarEvent, type Schedule, type Task } from "./schema";
import { addDays, dateRange, fromMinutes, toMinutes, weekday, type DateStr, type TimeStr } from "./time";

/**
 * One model for everything on the calendar: class meetings, tasks (deadlines and exams) and events.
 * The calendar, the dashboard, conflict checks and reminders all read from this, so they always agree.
 */
export interface AgendaItem {
  /** Unique per calendar entry (repeating events get one id per date). */
  id: string;
  kind: "class" | "task" | "event";
  /** Session kind, task type or event category; used for colours and filters. */
  category: string;
  title: string;
  courseCode: string | null;
  date: DateStr;
  /** Null = all day (or "end of day" for a deadline without a time). */
  start: TimeStr | null;
  end: TimeStr | null;
  location: string;
  /** Cancelled classes and finished tasks stay visible, marked. */
  inactive: boolean;
  note: string;
  ref: { type: "occurrence" | "task" | "event"; id: string };
  occurrence?: ClassOccurrence;
  task?: Task;
  event?: CalendarEvent;
}

export type CourseTitle = (code: string) => string;

function taskItem(t: Task, title: CourseTitle): AgendaItem {
  const timed = TIMED_TYPES.has(t.type) && t.dueTime;
  return {
    id: `task:${t.id}`,
    kind: "task",
    category: t.type,
    title: t.title,
    courseCode: t.courseCode,
    date: t.dueDate,
    start: t.dueTime,
    end: timed && t.durationMin ? fromMinutes(toMinutes(t.dueTime!) + t.durationMin) : null,
    location: t.location,
    inactive: t.done,
    note: t.courseCode ? title(t.courseCode) : "",
    ref: { type: "task", id: t.id },
    task: t,
  };
}

function eventDates(e: CalendarEvent, schedule: Schedule, from: DateStr, to: DateStr): DateStr[] {
  if (e.repeat === "none") return e.date >= from && e.date <= to ? [e.date] : [];
  const until = e.until ?? schedule.term?.end ?? addDays(e.date, 7 * 16);
  const start = e.date > from ? e.date : from;
  const end = until < to ? until : to;
  if (end < start) return [];
  const day = weekday(e.date);
  return dateRange(start, end).filter((d) => weekday(d) === day);
}

export function agendaItems(
  schedule: Schedule,
  from: DateStr,
  to: DateStr,
  title: CourseTitle,
  options: { includeHidden?: boolean } = {},
): AgendaItem[] {
  const items: AgendaItem[] = [];

  for (const o of classOccurrences(schedule, from, to)) {
    items.push({
      id: `class:${o.id}`,
      kind: "class",
      category: o.kind,
      title: title(o.courseCode),
      courseCode: o.courseCode,
      date: o.date,
      start: o.start,
      end: o.end,
      location: locationLine(o),
      inactive: o.status !== "scheduled",
      note: o.status === "cancelled" ? "Cancelled" : o.status === "holiday" ? `No class: ${o.holidayName}` : o.moved ? "Rescheduled" : o.makeup ? "Makeup class" : "",
      ref: { type: "occurrence", id: o.id },
      occurrence: o,
    });
  }

  for (const t of schedule.tasks) {
    if (t.dueDate >= from && t.dueDate <= to) items.push(taskItem(t, title));
  }

  for (const e of schedule.events) {
    if (!e.inCalendar && !options.includeHidden) continue;
    for (const d of eventDates(e, schedule, from, to)) {
      items.push({
        id: e.repeat === "none" ? `event:${e.id}` : `event:${e.id}@${d}`,
        kind: "event",
        category: e.category,
        title: e.title,
        courseCode: e.courseCode,
        date: d,
        start: e.start,
        end: e.end,
        location: e.location,
        inactive: false,
        note: "",
        ref: { type: "event", id: e.id },
        event: e,
      });
    }
  }

  return items.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.start ?? "").localeCompare(b.start ?? "") ||
      a.kind.localeCompare(b.kind) ||
      a.title.localeCompare(b.title),
  );
}

/** Start and end in minutes for overlap checks (deadlines without a duration are points in time). */
export function itemSpan(item: AgendaItem): { start: number; end: number } | null {
  if (!item.start) return null;
  const start = toMinutes(item.start);
  const end = item.end ? toMinutes(item.end) : start;
  return { start, end };
}
