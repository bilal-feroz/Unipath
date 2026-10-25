import { TASK_TYPE_LABEL, type TaskType } from "./schema";
import { addDays, isValidDate, type DateStr, type TimeStr } from "./time";

/**
 * Finds academic dates in pasted text (course outlines, assignment sheets, announcements) with plain
 * rules. Nothing found here is saved until the student checks it; anything uncertain is flagged.
 */

export type ExtractedType = TaskType | "event";

export type ExtractFlag = "no-year" | "no-time" | "ambiguous-date" | "no-date" | "no-course" | "past-date" | "unknown-type";

export interface ExtractedItem {
  id: string;
  title: string;
  type: ExtractedType;
  courseCode: string | null;
  date: DateStr | null;
  time: TimeStr | null;
  location: string;
  /** The text it came from, so the student can check it. */
  source: string;
  confidence: "high" | "medium" | "low";
  flags: ExtractFlag[];
}

export const FLAG_TEXT: Record<ExtractFlag, string> = {
  "no-year": "No year given — UniPath picked the next one. Check it.",
  "no-time": "No time given — it will count as due at the end of the day.",
  "ambiguous-date": "This date could be day/month or month/day. Check it.",
  "no-date": "No date found.",
  "no-course": "No course found.",
  "past-date": "This date has already passed.",
  "unknown-type": "Couldn't tell what kind of deadline this is.",
};

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?";

const TYPE_RULES: [RegExp, ExtractedType][] = [
  [/\bfinal\s+(exam|examination|test)\b|\bfinals?\b(?!\s+(?:report|project|submission|presentation))/i, "final"],
  [/\bmid[\s-]?terms?\b|\bmid[\s-]?semester\s+exam/i, "midterm"],
  [/\bquiz(?:zes)?\b/i, "quiz"],
  [/\b(exam|examination)\b/i, "exam"],
  [/\bpresentations?\b|\bdemo\b|\bviva\b/i, "presentation"],
  [/\blab\s*(report|sheet|assignment)?\b/i, "lab"],
  [/\bprojects?\b|\bproposals?\b|\bmilestones?\b|\bdeliverables?\b/i, "project"],
  [/\bassignments?\b|\bhomework\b|\bhw\s*\d|\bessay\b|\bsubmission\b|\breport\b|\bcoursework\b/i, "assignment"],
  [/\bregistration\b|\badd\s*\/\s*drop\b|\benrol(?:l)?ment\b|\bregister\b/i, "registration"],
  [/\btuition\b|\bfees?\b|\bpayment\b/i, "payment"],
  [/\bwithdraw(?:al)?\b|\bdeadline\b|\bpetition\b|\bappeal\b/i, "admin"],
  [/\bworkshop\b|\bseminar\b|\bcareer\s+fair\b|\bhackathon\b|\bcompetition\b|\bevent\b|\bwebinar\b/i, "event"],
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function makeDate(y: number, m: number, d: number): DateStr | null {
  const s = `${y}-${pad(m)}-${pad(d)}`;
  return isValidDate(s) ? s : null;
}

/** With no year given: the first date on or after a week ago. */
function inferYear(m: number, d: number, today: DateStr): DateStr | null {
  const y = Number(today.slice(0, 4));
  for (const year of [y, y + 1]) {
    const date = makeDate(year, m, d);
    if (date && date >= addDays(today, -7)) return date;
  }
  return makeDate(y, m, d);
}

function fullYear(y: string): number {
  const n = Number(y);
  return y.length === 2 ? 2000 + n : n;
}

interface DateMatch {
  date: DateStr | null;
  flags: ExtractFlag[];
  index: number;
  length: number;
}

function findDate(text: string, today: DateStr): DateMatch | null {
  const iso = /\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/.exec(text);
  if (iso) return { date: makeDate(+iso[1], +iso[2], +iso[3]), flags: [], index: iso.index, length: iso[0].length };

  const dayFirst = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH},?(?:\\s+(\\d{4}))?`, "i").exec(text);
  const monthFirst = new RegExp(`\\b${MONTH}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s+(\\d{4}))?`, "i").exec(text);
  const named = [dayFirst && { m: dayFirst, day: +dayFirst[1], mon: dayFirst[2], year: dayFirst[3] }, monthFirst && { m: monthFirst, day: +monthFirst[2], mon: monthFirst[1], year: monthFirst[3] }]
    .filter(Boolean)
    .sort((a, b) => a!.m.index - b!.m.index)[0];
  if (named) {
    const month = MONTHS.indexOf(named.mon.slice(0, 3).toLowerCase()) + 1;
    const date = named.year ? makeDate(+named.year, month, named.day) : inferYear(month, named.day, today);
    return { date, flags: named.year ? [] : ["no-year"], index: named.m.index, length: named.m[0].length };
  }

  const numeric = /\b(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?\b/.exec(text);
  if (numeric) {
    const a = +numeric[1];
    const b = +numeric[2];
    const flags: ExtractFlag[] = [];
    // Day/month is the usual order in the UAE; flag it when both readings are possible.
    let day = a;
    let month = b;
    if (a <= 12 && b > 12) {
      day = b;
      month = a;
    } else if (a <= 12 && b <= 12 && a !== b) flags.push("ambiguous-date");
    if (month < 1 || month > 12) return null;
    const date = numeric[3] ? makeDate(fullYear(numeric[3]), month, day) : inferYear(month, day, today);
    if (!numeric[3]) flags.push("no-year");
    return date ? { date, flags, index: numeric.index, length: numeric[0].length } : null;
  }
  return null;
}

function findTime(text: string): TimeStr | null {
  const ampm = /\b(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?m\.?|p\.?m\.?)(?![a-z])/i.exec(text);
  if (ampm) {
    let h = +ampm[1] % 12;
    if (/^p/i.test(ampm[3])) h += 12;
    const m = ampm[2] ? +ampm[2] : 0;
    if (h < 24 && m < 60) return `${pad(h)}:${pad(m)}`;
  }
  const h24 = /\b([01]?\d|2[0-3])[:h]([0-5]\d)\b/.exec(text);
  if (h24) return `${pad(+h24[1])}:${h24[2]}`;
  if (/\bnoon\b|\bmidday\b/i.test(text)) return "12:00";
  if (/\bmidnight\b/i.test(text)) return "23:59";
  return null;
}

function findType(text: string): ExtractedType | null {
  for (const [re, type] of TYPE_RULES) if (re.test(text)) return type;
  return null;
}

export interface CourseRef {
  code: string;
  title: string;
}

function findCourse(text: string, courses: CourseRef[]): CourseRef | null {
  const code = /\b(\d{7})\b/.exec(text)?.[1];
  if (code) {
    const byCode = courses.find((c) => c.code === code);
    if (byCode) return byCode;
  }
  const lower = text.toLowerCase();
  return [...courses].sort((a, b) => b.title.length - a.title.length).find((c) => lower.includes(c.title.toLowerCase())) ?? null;
}

function findLocation(text: string): string {
  const m = /\b(?:in|at|venue:?|location:?|room)\s+((?:building|bldg\.?|room|hall|lab|auditorium)\s*[\w-]+(?:[ ,]+(?:room|rm\.?)\s*[\w-]+)?)/i.exec(text);
  return m ? m[1].trim() : "";
}

function titleFor(segment: string, type: ExtractedType | null, course: CourseRef | null): string {
  const numbered = /\b(assignment|homework|hw|quiz|project|lab(?:\s+report)?|milestone|deliverable|presentation|midterm|exam)\s*#?\s*(\d+)\b/i.exec(segment);
  if (numbered) {
    const name = numbered[1][0].toUpperCase() + numbered[1].slice(1).toLowerCase();
    return [course?.title, `${name} ${numbered[2]}`].filter(Boolean).join(" ");
  }
  if (type && type !== "event" && type !== "other") {
    const label = type === "final" ? "final exam" : TASK_TYPE_LABEL[type].toLowerCase();
    return course ? `${course.title} ${label}` : TASK_TYPE_LABEL[type];
  }
  const clean = segment.replace(/\s+/g, " ").trim();
  return clean.length > 80 ? `${clean.slice(0, 77)}…` : clean;
}

/** Splits text into sentences and lines, keeping each short enough to judge on its own. */
function segments(text: string): string[] {
  return text
    .replace(/\r/g, "")
    .split(/\n+|(?<=[.!?;])\s+(?=[A-Z0-9])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3 && s.length < 500);
}

export function extractDeadlines(text: string, options: { today: DateStr; courses: CourseRef[] }): ExtractedItem[] {
  const { today, courses } = options;
  const out: ExtractedItem[] = [];
  // If the whole text is about one course (a course outline), use it where a line doesn't say.
  const mentioned = new Set(courses.filter((c) => text.toLowerCase().includes(c.title.toLowerCase()) || text.includes(c.code)).map((c) => c.code));
  const documentCourse = mentioned.size === 1 ? courses.find((c) => mentioned.has(c.code)) ?? null : null;
  let n = 0;

  for (const seg of segments(text)) {
    const found = findDate(seg, today);
    if (!found) continue;
    const type = findType(seg);
    const course = findCourse(seg, courses) ?? documentCourse;
    const time = findTime(seg.slice(found.index)) ?? findTime(seg);
    const flags = [...found.flags];
    if (!found.date) flags.push("no-date");
    if (!time) flags.push("no-time");
    if (!course && type !== "registration" && type !== "payment" && type !== "admin" && type !== "event") flags.push("no-course");
    if (!type) flags.push("unknown-type");
    if (found.date && found.date < today) flags.push("past-date");
    const confidence: ExtractedItem["confidence"] =
      flags.includes("ambiguous-date") || flags.includes("unknown-type") || flags.includes("no-date")
        ? "low"
        : flags.includes("no-year") || flags.includes("no-course") || flags.includes("past-date")
          ? "medium"
          : "high";
    out.push({
      id: `found-${n++}`,
      title: titleFor(seg, type, course),
      type: type ?? "other",
      courseCode: course?.code ?? null,
      date: found.date,
      time,
      location: findLocation(seg),
      source: seg,
      confidence,
      flags,
    });
  }
  return out;
}

/** Items that need the student's eye before saving. */
export function needsReview(item: ExtractedItem): boolean {
  return item.confidence !== "high";
}
