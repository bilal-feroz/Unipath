import type { Schedule, SessionKind } from "./schema";
import { dateRange, type DateStr, type TimeStr, weekday } from "./time";

export type OccurrenceStatus = "scheduled" | "cancelled" | "holiday";

/** One meeting of a class on a specific date. */
export interface ClassOccurrence {
  /** "sessionId@originalDate" for weekly classes, "extra:id" for one-off classes. Attendance is keyed by this. */
  id: string;
  sessionId: string | null;
  courseCode: string;
  kind: SessionKind;
  date: DateStr;
  start: TimeStr;
  end: TimeStr;
  professor: string;
  building: string;
  floor: string;
  room: string;
  status: OccurrenceStatus;
  /** Moved from its usual date or time. */
  moved: boolean;
  originalDate: DateStr | null;
  originalStart: TimeStr | null;
  makeup: boolean;
  holidayName: string | null;
  note: string;
  exceptionId: string | null;
}

export function occurrenceId(sessionId: string, date: DateStr): string {
  return `${sessionId}@${date}`;
}

function holidayOn(schedule: Schedule, date: DateStr): string | null {
  const h = schedule.term?.holidays.find((x) => date >= x.start && date <= x.end);
  return h ? h.name : null;
}

/**
 * Every class meeting this semester that falls between `from` and `to` (inclusive), in date and time
 * order. Weekly classes run from the semester's start to its end; exceptions and holidays are applied,
 * and cancelled meetings are kept (with their status) so they can be shown.
 */
export function classOccurrences(schedule: Schedule, from: DateStr, to: DateStr): ClassOccurrence[] {
  const term = schedule.term;
  if (!term || to < from) return [];
  const out: ClassOccurrence[] = [];
  const exceptions = new Map(schedule.exceptions.map((e) => [`${e.sessionId}@${e.date}`, e]));

  for (const date of dateRange(term.start, term.end)) {
    const day = weekday(date);
    for (const s of schedule.sessions) {
      if (!s.days.includes(day)) continue;
      const baseId = occurrenceId(s.id, date);
      const ex = exceptions.get(baseId);
      const holiday = holidayOn(schedule, date);
      const occ: ClassOccurrence = {
        id: baseId,
        sessionId: s.id,
        courseCode: s.courseCode,
        kind: s.kind,
        date,
        start: s.start,
        end: s.end,
        professor: s.professor,
        building: s.building,
        floor: s.floor,
        room: s.room,
        status: "scheduled",
        moved: false,
        originalDate: null,
        originalStart: null,
        makeup: false,
        holidayName: null,
        note: ex?.note ?? "",
        exceptionId: ex?.id ?? null,
      };
      if (ex?.type === "cancelled") {
        occ.status = "cancelled";
      } else if (ex?.type === "moved") {
        occ.moved = true;
        occ.originalDate = date;
        occ.originalStart = s.start;
        occ.date = ex.toDate ?? date;
        occ.start = ex.start ?? s.start;
        occ.end = ex.end ?? s.end;
        if (ex.building !== null) occ.building = ex.building;
        if (ex.room !== null) occ.room = ex.room;
        const movedHoliday = holidayOn(schedule, occ.date);
        if (movedHoliday) {
          occ.status = "holiday";
          occ.holidayName = movedHoliday;
        }
      } else if (holiday) {
        occ.status = "holiday";
        occ.holidayName = holiday;
      }
      out.push(occ);
    }
  }

  for (const x of schedule.extras) {
    out.push({
      id: `extra:${x.id}`,
      sessionId: null,
      courseCode: x.courseCode,
      kind: x.kind,
      date: x.date,
      start: x.start,
      end: x.end,
      professor: x.professor,
      building: x.building,
      floor: x.floor,
      room: x.room,
      status: "scheduled",
      moved: false,
      originalDate: null,
      originalStart: null,
      makeup: true,
      holidayName: null,
      note: x.note,
      exceptionId: null,
    });
  }

  return out
    .filter((o) => o.date >= from && o.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start) || a.courseCode.localeCompare(b.courseCode));
}

/** Where a class meets, as one line: "Building B · Floor 2 · Room 204". */
export function locationLine(o: { building: string; floor?: string; room: string }): string {
  return [o.building, o.floor ? `Floor ${o.floor}` : "", o.room ? `Room ${o.room}` : ""].filter(Boolean).join(" · ");
}
