/**
 * Calendar dates ("YYYY-MM-DD") and wall-clock times ("HH:mm") as the campus sees them.
 * Classes happen at local campus times, so dates and times are stored as plain strings and all
 * date arithmetic is done in UTC to avoid daylight-saving surprises.
 */

export type DateStr = string;
export type TimeStr = string;

export const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function toMinutes(time: TimeStr): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function fromMinutes(minutes: number): TimeStr {
  const m = Math.max(0, Math.min(24 * 60 - 1, Math.round(minutes)));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function toUtc(date: DateStr): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(d: Date): DateStr {
  return d.toISOString().slice(0, 10);
}

export function isValidDate(date: string): boolean {
  if (!DATE_RE.test(date)) return false;
  return fromUtc(toUtc(date)) === date;
}

export function addDays(date: DateStr, days: number): DateStr {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}

/** Days from `a` to `b` (positive when `b` is later). */
export function diffDays(a: DateStr, b: DateStr): number {
  return Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / 86_400_000);
}

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export function weekday(date: DateStr): number {
  const day = toUtc(date).getUTCDay();
  return day === 0 ? 7 : day;
}

export function startOfWeek(date: DateStr): DateStr {
  return addDays(date, 1 - weekday(date));
}

/** Every date from `from` to `to`, inclusive. */
export function dateRange(from: DateStr, to: DateStr): DateStr[] {
  const out: DateStr[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** The 6 × 7 grid of dates shown for a month, starting on a Monday. */
export function monthGrid(year: number, month: number): DateStr[] {
  const first = `${year}-${String(month).padStart(2, "0")}-01`;
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function monthOf(date: DateStr): { year: number; month: number } {
  const [y, m] = date.split("-").map(Number);
  return { year: y, month: m };
}

export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export interface ZonedNow {
  date: DateStr;
  /** Minutes since midnight. */
  minutes: number;
  timeZone: string;
}

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Today's date and the time of day in `timeZone` (the device's zone when not given). */
export function zonedNow(now: Date, timeZone?: string | null): ZonedNow {
  const zone = timeZone || deviceTimeZone();
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
  } catch {
    return zonedNow(now, "UTC");
  }
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
    timeZone: zone,
  };
}

/** Minutes from now until `time` on `date` (negative when it has passed). */
export function minutesUntil(now: ZonedNow, date: DateStr, time: TimeStr | null): number {
  return diffDays(now.date, date) * 24 * 60 + (time ? toMinutes(time) : 24 * 60 - 1) - now.minutes;
}

export function formatTime(time: TimeStr): string {
  const m = toMinutes(time);
  const h = Math.floor(m / 60);
  const suffix = h < 12 ? "AM" : "PM";
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m % 60).padStart(2, "0")} ${suffix}`;
}

export function formatTimeRange(start: TimeStr | null, end: TimeStr | null): string {
  if (!start) return "All day";
  return end ? `${formatTime(start)} – ${formatTime(end)}` : formatTime(start);
}

export function formatDate(date: DateStr, options: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }): string {
  return toUtc(date).toLocaleDateString("en-GB", { ...options, timeZone: "UTC" });
}

export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const WEEKDAY_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** "today", "tomorrow", "in 3 days", "yesterday", "4 days ago". */
export function relativeDay(date: DateStr, today: DateStr): string {
  const d = diffDays(today, date);
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  if (d === -1) return "yesterday";
  if (d > 1 && d < 7) return `on ${WEEKDAY_LONG[weekday(date) - 1]}`;
  return d > 0 ? `in ${d} days` : `${-d} days ago`;
}

/** "in 15 min", "in 2 h 5 min", "now". */
export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 1) return "now";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h < 24) return rest ? `${h} h ${rest} min` : `${h} h`;
  const days = Math.round(h / 24);
  return `${days} ${days === 1 ? "day" : "days"}`;
}
