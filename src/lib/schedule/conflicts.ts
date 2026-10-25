import { agendaItems, itemSpan, type CourseTitle } from "./agenda";
import { courseAttendance, timetableCourses } from "./attendance";
import { classOccurrences, type ClassOccurrence } from "./occurrences";
import { ADMIN_TYPES, EXAM_TYPES, TASK_TYPE_LABEL, TIMED_TYPES, type LifeSettings, type Schedule, type Task } from "./schema";
import { rankTask } from "./tasks";
import {
  addDays,
  diffDays,
  formatDate,
  formatTime,
  formatTimeRange,
  overlaps,
  relativeDay,
  toMinutes,
  WEEKDAY_LONG,
  weekday,
  type DateStr,
  type ZonedNow,
} from "./time";

export type AlertRule =
  | "class-overlap"
  | "exam-clash"
  | "deadline-cluster"
  | "event-class"
  | "travel"
  | "attendance"
  | "admin-deadline";

export type AlertSeverity = "critical" | "warning" | "info";

export interface Alert {
  /** Stable while the conflict is unchanged, so dismissing it sticks; changes when the conflict changes. */
  id: string;
  rule: AlertRule;
  severity: AlertSeverity;
  title: string;
  /** Why it matters, with the facts it's based on. */
  why: string;
  /** What the student can do. */
  action: string;
  affected: { type: "session" | "occurrence" | "task" | "event" | "course"; id: string; label: string }[];
  /** When it happens (the first date, for repeating conflicts). */
  date: DateStr | null;
  href: string;
}

const SEVERITY_ORDER: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function dayList(dates: DateStr[]): string {
  const days = [...new Set(dates.map((d) => weekday(d)))].sort();
  return days.map((d) => `${WEEKDAY_LONG[d - 1]}s`).join(" and ");
}

function sameBuilding(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Pairs of class meetings, grouped by the classes involved, so a weekly clash is one alert. */
function groupPairs(
  occurrences: ClassOccurrence[],
  test: (a: ClassOccurrence, b: ClassOccurrence) => boolean,
  consecutiveOnly: boolean,
) {
  const groups = new Map<string, { a: ClassOccurrence; b: ClassOccurrence; dates: DateStr[] }>();
  const byDate = new Map<DateStr, ClassOccurrence[]>();
  for (const o of occurrences) byDate.set(o.date, [...(byDate.get(o.date) ?? []), o]);
  for (const [date, list] of byDate) {
    const sorted = [...list].sort((x, y) => x.start.localeCompare(y.start));
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        if (consecutiveOnly && j !== i + 1) break;
        const a = sorted[i];
        const b = sorted[j];
        if (!test(a, b)) continue;
        const key = [a.sessionId ?? a.id, b.sessionId ?? b.id, a.start, a.end, b.start, b.end, a.building, b.building].join("|");
        const g = groups.get(key) ?? { a, b, dates: [] };
        g.dates.push(date);
        groups.set(key, g);
      }
    }
  }
  return [...groups.entries()];
}

export function detectConflicts(
  schedule: Schedule,
  settings: LifeSettings,
  now: ZonedNow,
  title: CourseTitle,
): Alert[] {
  const alerts: Alert[] = [];
  const today = now.date;
  const term = schedule.term;
  const horizon = term && term.end > today ? term.end : addDays(today, 30);
  const upcoming = classOccurrences(schedule, today, horizon).filter(
    (o) => o.status === "scheduled" && !(o.date === today && toMinutes(o.end) <= now.minutes),
  );

  // 1. Classes that overlap.
  for (const [key, g] of groupPairs(
    upcoming,
    (a, b) => overlaps(toMinutes(a.start), toMinutes(a.end), toMinutes(b.start), toMinutes(b.end)),
    false,
  )) {
    const { a, b, dates } = g;
    const minutes = Math.min(toMinutes(a.end), toMinutes(b.end)) - Math.max(toMinutes(a.start), toMinutes(b.start));
    const weekly = !!a.sessionId && !!b.sessionId && !a.moved && !b.moved;
    alerts.push({
      id: `class-overlap:${key}`,
      rule: "class-overlap",
      severity: "critical",
      title: weekly ? `Two classes overlap on ${dayList(dates)}` : `Two classes overlap ${relativeDay(dates[0], today)}`,
      why: `${title(a.courseCode)} (${formatTimeRange(a.start, a.end)}) and ${title(b.courseCode)} (${formatTimeRange(b.start, b.end)}) overlap by ${minutes} minutes${weekly ? "" : ` on ${formatDate(dates[0])}`}.`,
      action: weekly
        ? "Check the times in your timetable. If your registration really has both, ask your advisor about changing a section."
        : "Check which class you'll attend and let the other instructor know.",
      affected: [
        { type: a.sessionId ? "session" : "occurrence", id: a.sessionId ?? a.id, label: title(a.courseCode) },
        { type: b.sessionId ? "session" : "occurrence", id: b.sessionId ?? b.id, label: title(b.courseCode) },
      ],
      date: dates[0],
      href: "/timetable",
    });
  }

  // 2. Not enough time to get between buildings.
  const buffer = settings.travelBufferMin;
  if (buffer > 0) {
    for (const [key, g] of groupPairs(
      upcoming,
      (a, b) => {
        const gap = toMinutes(b.start) - toMinutes(a.end);
        return gap >= 0 && gap < buffer && !!a.building && !!b.building && !sameBuilding(a.building, b.building);
      },
      true,
    )) {
      const { a, b, dates } = g;
      const gap = toMinutes(b.start) - toMinutes(a.end);
      alerts.push({
        id: `travel:${key}`,
        rule: "travel",
        severity: "warning",
        title: `Tight change of building on ${dayList(dates)}`,
        why: `${title(b.courseCode)} starts ${gap === 0 ? "right when" : `${gap} minutes after`} ${title(a.courseCode)} ends, and they're in different buildings (${a.building} → ${b.building}). You set ${buffer} minutes as the time you need to change buildings.`,
        action: "Leave a little early, or plan your route in CampusFlow.",
        affected: [
          { type: a.sessionId ? "session" : "occurrence", id: a.sessionId ?? a.id, label: title(a.courseCode) },
          { type: b.sessionId ? "session" : "occurrence", id: b.sessionId ?? b.id, label: title(b.courseCode) },
        ],
        date: dates[0],
        href: "/campus",
      });
    }
  }

  // 3. Exams at the same time or back to back.
  const exams = schedule.tasks
    .filter((t) => !t.done && EXAM_TYPES.has(t.type) && t.dueTime && t.dueDate >= today)
    .sort((x, y) => x.dueDate.localeCompare(y.dueDate) || x.dueTime!.localeCompare(y.dueTime!));
  for (let i = 0; i < exams.length; i++) {
    for (let j = i + 1; j < exams.length && exams[j].dueDate === exams[i].dueDate; j++) {
      const a = exams[i];
      const b = exams[j];
      const aStart = toMinutes(a.dueTime!);
      const aEnd = aStart + (a.durationMin ?? 0);
      const bStart = toMinutes(b.dueTime!);
      const bEnd = bStart + (b.durationMin ?? 0);
      const clash = aStart === bStart || overlaps(aStart, Math.max(aEnd, aStart + 1), bStart, Math.max(bEnd, bStart + 1));
      const gap = bStart - aEnd;
      if (!clash && gap >= settings.examGapMin) continue;
      const unknown = a.durationMin === null ? ` (the length of ${a.title} isn't set, so this counts from its start time)` : "";
      alerts.push({
        id: `exam-clash:${a.id}|${b.id}:${a.dueDate}:${a.dueTime}-${a.durationMin}|${b.dueTime}-${b.durationMin}`,
        rule: "exam-clash",
        severity: clash ? "critical" : "warning",
        title: clash ? `Two exams at the same time ${relativeDay(a.dueDate, today)}` : `Exams back to back ${relativeDay(a.dueDate, today)}`,
        why: clash
          ? `${a.title} (${formatTime(a.dueTime!)}) and ${b.title} (${formatTime(b.dueTime!)}) overlap on ${formatDate(a.dueDate)}.`
          : `Only ${gap} minutes between ${a.title} and ${b.title} on ${formatDate(a.dueDate)}${unknown}. You asked to be warned below ${settings.examGapMin} minutes.`,
        action: clash
          ? "Contact your instructors or the registrar now — exam clashes usually need to be reported before the exam period."
          : "Plan your revision so you're not studying for both the night before.",
        affected: [
          { type: "task", id: a.id, label: a.title },
          { type: "task", id: b.id, label: b.title },
        ],
        date: a.dueDate,
        href: "/tasks",
      });
    }
  }

  // 4. Several deadlines on one day.
  const window = addDays(today, 21);
  const byDay = new Map<DateStr, Task[]>();
  for (const t of schedule.tasks) {
    if (t.done || t.type === "other" || ADMIN_TYPES.has(t.type) || t.dueDate < today || t.dueDate > window) continue;
    byDay.set(t.dueDate, [...(byDay.get(t.dueDate) ?? []), t]);
  }
  for (const [day, list] of byDay) {
    if (list.length < settings.clusterThreshold) continue;
    const heaviest = [...list].sort((x, y) => rankTask(y, now).score - rankTask(x, now).score)[0];
    alerts.push({
      id: `deadline-cluster:${day}:${list.map((t) => t.id).sort().join("|")}`,
      rule: "deadline-cluster",
      severity: diffDays(today, day) <= 3 ? "warning" : "info",
      title: `${plural(list.length, "deadline")} on ${formatDate(day, { weekday: "long" })}`,
      why: `${list.map((t) => t.title).join(", ")} are all due ${relativeDay(day, today)} (${formatDate(day)}).`,
      action: `Consider finishing ${heaviest.title} earlier.`,
      affected: list.map((t) => ({ type: "task" as const, id: t.id, label: t.title })),
      date: day,
      href: "/tasks",
    });
  }

  // 5. Events and exams that clash with a class.
  const twoWeeks = addDays(today, 14);
  const items = agendaItems(schedule, today, twoWeeks, title);
  const classes = items.filter((i) => i.kind === "class" && !i.inactive);
  const commitments = items.filter(
    (i) =>
      !i.inactive &&
      i.start &&
      ((i.kind === "event" && i.end) || (i.kind === "task" && i.task && TIMED_TYPES.has(i.task.type))),
  );
  for (const c of commitments) {
    const span = itemSpan(c)!;
    const end = Math.max(span.end, span.start + (c.task?.durationMin ?? 1));
    for (const k of classes) {
      if (k.date !== c.date || (c.courseCode && c.courseCode === k.courseCode)) continue;
      const ks = itemSpan(k)!;
      if (!overlaps(span.start, end, ks.start, ks.end)) continue;
      if (c.date === today && ks.end <= now.minutes) continue;
      alerts.push({
        id: `event-class:${c.id}|${k.id}:${c.start}-${c.end}|${k.start}-${k.end}`,
        rule: "event-class",
        severity: "warning",
        title: `${c.title} clashes with a class ${relativeDay(c.date, today)}`,
        why: `${c.title} (${formatTimeRange(c.start, c.end)}) overlaps ${k.title} (${formatTimeRange(k.start, k.end)}) on ${formatDate(c.date)}.`,
        action:
          c.kind === "event"
            ? "Move the event, or let your instructor know if you'll miss the class."
            : "Tell your instructor about the clash as early as you can.",
        affected: [
          { type: c.kind === "event" ? "event" : "task", id: c.ref.id, label: c.title },
          { type: "occurrence", id: k.ref.id, label: k.title },
        ],
        date: c.date,
        href: "/calendar",
      });
    }
  }

  // 6. Attendance close to the student's limit.
  for (const code of timetableCourses(schedule)) {
    const a = courseAttendance(schedule, settings, code, now);
    if (a.risk !== "warning" && a.risk !== "exceeded") continue;
    const left = a.remainingAbsences!;
    alerts.push({
      id: `attendance:${code}:${a.risk}:${left}`,
      rule: "attendance",
      severity: a.risk === "exceeded" ? "critical" : "warning",
      title:
        a.risk === "exceeded"
          ? `Over the absence limit in ${title(code)}`
          : `Attendance warning: ${left === 0 ? "no absences" : plural(left, "absence")} left in ${title(code)}`,
      why: `${plural(a.absences, "absence")} so far. ${a.basis}`,
      action:
        a.risk === "exceeded"
          ? "Talk to your instructor or advisor about what this means for the course."
          : "Try not to miss the next classes. If an absence was excused, mark it as excused.",
      affected: [{ type: "course", id: code, label: title(code) }],
      date: null,
      href: "/attendance",
    });
  }

  // 7. Registration, payment and other admin deadlines coming up.
  const adminWindow = addDays(today, settings.adminWarnDays);
  for (const t of schedule.tasks) {
    if (t.done || !ADMIN_TYPES.has(t.type) || t.dueDate < today || t.dueDate > adminWindow) continue;
    alerts.push({
      id: `admin:${t.id}:${t.dueDate}`,
      rule: "admin-deadline",
      severity: diffDays(today, t.dueDate) <= 1 ? "warning" : "info",
      title: `${t.title} ${t.dueDate === today ? "is due today" : `closes ${relativeDay(t.dueDate, today)}`}`,
      why: `${TASK_TYPE_LABEL[t.type]} deadline on ${formatDate(t.dueDate)}${t.dueTime ? ` at ${formatTime(t.dueTime)}` : ""}. Missing it can block registration or add fees.`,
      action: "Do it now, or set a reminder for when you'll have time.",
      affected: [{ type: "task", id: t.id, label: t.title }],
      date: t.dueDate,
      href: "/tasks",
    });
  }
  for (const e of schedule.events) {
    if ((e.category !== "registration" && e.category !== "admin") || e.date < today || e.date > adminWindow) continue;
    alerts.push({
      id: `admin:${e.id}:${e.date}`,
      rule: "admin-deadline",
      severity: diffDays(today, e.date) <= 1 ? "warning" : "info",
      title: `${e.title} ${relativeDay(e.date, today)}`,
      why: `On ${formatDate(e.date)}${e.start ? ` at ${formatTime(e.start)}` : ""}.`,
      action: "Make sure everything is ready before then.",
      affected: [{ type: "event", id: e.id, label: e.title }],
      date: e.date,
      href: "/calendar",
    });
  }

  return alerts.sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || (a.date ?? "").localeCompare(b.date ?? ""),
  );
}

/** Alerts the student hasn't dismissed, resolved or snoozed. */
export function visibleAlerts(alerts: Alert[], state: Schedule["alerts"], now: Date): Alert[] {
  const hidden = new Set([...state.dismissed, ...state.resolved]);
  return alerts.filter((a) => {
    if (hidden.has(a.id)) return false;
    const until = state.snoozed[a.id];
    return !until || new Date(until).getTime() <= now.getTime();
  });
}
