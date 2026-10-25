"use client";

import { ChevronDown, UserCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, Field, Input } from "@/components/ui/form";
import { Pill, type PillTone } from "@/components/ui/pill";
import { ProgressBar } from "@/components/ui/progress-bar";
import {
  bestReachablePercent,
  classesNeededFor,
  courseAttendance,
  percentIfMissNext,
  timetableCourses,
  type CourseAttendance,
} from "@/lib/schedule/attendance";
import { SESSION_KIND_LABEL } from "@/lib/schedule/schema";
import { formatDate, formatTimeRange } from "@/lib/schedule/time";
import { useAppStore } from "@/lib/state/store";
import { cn, plural } from "@/lib/utils";
import { AttendanceRuleFields } from "./attendance-rule-fields";
import { AttendanceButtons, MARK_LABEL } from "./meeting-dialog";
import { useSchedule } from "./schedule-context";

const RISK: Record<CourseAttendance["risk"], { label: string; tone: PillTone }> = {
  ok: { label: "On track", tone: "done" },
  warning: { label: "Close to the limit", tone: "warn" },
  exceeded: { label: "Over the limit", tone: "warn" },
  "no-rule": { label: "No rule set", tone: "neutral" },
};

function Forecast({ a }: { a: CourseAttendance }) {
  const [target, setTarget] = useState(a.rule.rule === "min-percent" ? String(a.rule.minPercent) : "");
  const t = Number(target);
  const needed = target && t > 0 && t <= 100 ? classesNeededFor(a, t) : undefined;
  const best = bestReachablePercent(a);
  return (
    <div className="space-y-2 rounded-xl border border-line bg-bg/40 p-3 text-sm">
      <p className="font-medium text-fg">What if…</p>
      {a.countable > 0 && a.upcoming.length > 0 && (
        <p className="text-muted">
          If you miss the next class: <span className="num font-medium text-fg">{percentIfMissNext(a)}%</span>
        </p>
      )}
      <p className="text-muted">
        {a.remainingAbsences === null ? (
          "Set a rule to see how many classes you can still miss."
        ) : a.remainingAbsences < 0 ? (
          <span className="text-warn">You&apos;re {plural(-a.remainingAbsences, "absence")} over your rule.</span>
        ) : (
          <>
            You can still miss <span className="num font-medium text-fg">{a.remainingAbsences}</span> {a.remainingAbsences === 1 ? "class" : "classes"} this semester.
          </>
        )}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Target %" className="w-28">
          {(id) => <Input id={id} type="number" min={1} max={100} placeholder="e.g. 80" value={target} onChange={(e) => setTarget(e.target.value)} />}
        </Field>
        <p className="pb-2 text-muted">
          {needed === undefined
            ? `${a.upcoming.length} classes left this semester.`
            : needed === null
              ? `Not reachable now — the best you can finish with is ${best}%.`
              : needed === 0
                ? "You'll reach it whatever happens."
                : `Attend at least ${needed} of the ${a.upcoming.length} remaining classes.`}
        </p>
      </div>
      <p className="text-[12px] text-dim">{a.basis}</p>
    </div>
  );
}

function CourseCard({ code }: { code: string }) {
  const { schedule, life, zoned, title } = useSchedule();
  const [open, setOpen] = useState(false);
  const a = courseAttendance(schedule, life, code, zoned);
  const override = life.attendance.perCourse[code];
  const risk = RISK[a.risk];
  return (
    <li className="glass rounded-2xl border border-line">
      <div className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-fg">{title(code)}</h3>
            <p className="text-[13px] text-muted">
              {a.held.length} held · {a.attended} attended · {a.absences} missed{a.excused ? ` · ${a.excused} excused` : ""}
              {a.unrecorded.length > 0 && <span className="text-warn"> · {a.unrecorded.length} not recorded</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Pill tone={risk.tone}>{risk.label}</Pill>
            <span className="num text-2xl font-semibold text-fg">{a.percent === null ? "—" : `${a.percent}%`}</span>
          </div>
        </div>
        {a.percent !== null && <ProgressBar className="mt-3" value={a.percent} max={100} tone={a.risk === "ok" || a.risk === "no-rule" ? "done" : "accent"} label={`${title(code)} attendance ${a.percent}%`} />}
        {a.allowedAbsences !== null && (
          <p className="mt-2 text-[13px] text-muted">
            {a.absences} of {a.allowedAbsences} allowed absences used.
          </p>
        )}
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-accent">
          <ChevronDown aria-hidden className={cn("size-4 transition-transform", open && "rotate-180")} /> {open ? "Hide" : "Records, forecast and rule"}
        </button>
      </div>
      {open && (
        <div className="space-y-4 border-t border-line p-4">
          <Forecast a={a} />
          <div>
            <p className="mb-1 text-[13px] font-medium text-fg">Rule for this course</p>
            <AttendanceRuleFields
              allowInherit
              inherit={!override}
              onInherit={(inherit) =>
                useAppStore.getState().updateLife((l) => {
                  const perCourse = { ...l.attendance.perCourse };
                  if (inherit) delete perCourse[code];
                  else perCourse[code] = perCourse[code] ?? { rule: l.attendance.rule, maxAbsences: l.attendance.maxAbsences, minPercent: l.attendance.minPercent };
                  return { ...l, attendance: { ...l.attendance, perCourse } };
                })
              }
              rule={override ?? life.attendance}
              onChange={(rule) => useAppStore.getState().updateLife((l) => ({ ...l, attendance: { ...l.attendance, perCourse: { ...l.attendance.perCourse, [code]: rule } } }))}
            />
          </div>
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-fg">Every class so far</p>
            {a.held.length === 0 ? (
              <p className="text-sm text-muted">No classes held yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {[...a.held].reverse().map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="text-[13px] text-fg">
                      {formatDate(o.date)} · {formatTimeRange(o.start, o.end)} <span className="text-muted">· {SESSION_KIND_LABEL[o.kind]}</span>
                    </span>
                    <AttendanceButtons occurrenceId={o.id} compact />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

export function AttendanceScreen() {
  const { schedule, life, zoned, title } = useSchedule();
  const courses = timetableCourses(schedule);
  const toRecord = courses
    .flatMap((c) => courseAttendance(schedule, life, c, zoned).unrecorded)
    .sort((a, b) => b.date.localeCompare(a.date) || b.start.localeCompare(a.start));

  return (
    <div className="page-in mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Attendance"
        description={
          life.attendance.rule === "none"
            ? "Record each class and see your percentage. Add your university's rule in Settings to see how many classes you can miss."
            : "Based on the attendance rule you entered. Holidays and cancelled classes don't count."
        }
        action={
          <Button asChild variant="secondary">
            <Link href="/settings">Attendance rule</Link>
          </Button>
        }
      />
      {courses.length === 0 ? (
        <EmptyState className="mt-6" icon={<UserCheck />} title="Add your timetable first" action={<Button asChild><Link href="/timetable">Go to Timetable</Link></Button>}>
          Attendance is tracked per class meeting, so UniPath needs to know when your classes are.
        </EmptyState>
      ) : (
        <div className="mt-6 space-y-4">
          {toRecord.length > 0 && (
            <Card aria-labelledby="record-title">
              <CardHeader titleId="record-title" title="Not recorded yet" description="Mark these so your numbers are right. You can change a mark at any time." />
              <CardBody>
                <ul className="divide-y divide-line">
                  {toRecord.slice(0, 8).map((o) => (
                    <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0">
                      <span className="min-w-0 text-sm">
                        <span className="font-medium text-fg">{title(o.courseCode)}</span>
                        <span className="text-muted"> · {formatDate(o.date)} · {formatTimeRange(o.start, o.end)}</span>
                      </span>
                      <AttendanceButtons occurrenceId={o.id} compact />
                    </li>
                  ))}
                </ul>
                {toRecord.length > 8 && <p className="mt-2 text-[13px] text-muted">And {toRecord.length - 8} more in the course details below.</p>}
              </CardBody>
            </Card>
          )}
          <ul className="space-y-3">
            {courses.map((c) => (
              <CourseCard key={c} code={c} />
            ))}
          </ul>
          <p className="text-[12.5px] text-dim">Marks: {Object.values(MARK_LABEL).join(", ")}. Excused classes are left out of the percentage.</p>
        </div>
      )}
    </div>
  );
}
