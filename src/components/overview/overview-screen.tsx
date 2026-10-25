"use client";

import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock,
  Compass,
  Gauge,
  GraduationCap,
  Hourglass,
  Lightbulb,
  ListChecks,
  ListTodo,
  MapPin,
  Plus,
  TriangleAlert,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { usePlanContext } from "@/components/app-shell/plan-context";
import { CourseDetailDialog } from "@/components/courses/course-detail-dialog";
import { useGpa, RATING_TONE } from "@/components/gpa/use-gpa";
import { AlertCard } from "@/components/schedule/alert-card";
import { AgendaRow, useItemOpener } from "@/components/schedule/agenda-row";
import { GROUP_META, itemGroup, taskGroup } from "@/components/schedule/item-style";
import { useSchedule } from "@/components/schedule/schedule-context";
import { TaskDialog } from "@/components/schedule/task-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Pill, type PillTone } from "@/components/ui/pill";
import { ProgressBar } from "@/components/ui/progress-bar";
import { getUniversity } from "@/lib/curriculum/registry";
import { forecastCgpa } from "@/lib/gpa/forecast";
import { agendaItems } from "@/lib/schedule/agenda";
import { locationLine, type ClassOccurrence } from "@/lib/schedule/occurrences";
import { todaysPriorities } from "@/lib/schedule/priorities";
import { TASK_TYPE_LABEL } from "@/lib/schedule/schema";
import { addDays, formatDate, formatDuration, formatTime, formatTimeRange, minutesUntil, relativeDay, toMinutes } from "@/lib/schedule/time";
import { useAppStore } from "@/lib/state/store";
import { cn, plural } from "@/lib/utils";

function greeting(minutes: number) {
  if (minutes < 12 * 60) return "Good morning";
  if (minutes < 17 * 60) return "Good afternoon";
  return "Good evening";
}

type ClassState = "done" | "now" | "next" | "later" | "cancelled";

function classState(o: ClassOccurrence, nowMin: number, nextId: string | null): ClassState {
  if (o.status !== "scheduled") return "cancelled";
  if (toMinutes(o.end) <= nowMin) return "done";
  if (toMinutes(o.start) <= nowMin) return "now";
  return o.id === nextId ? "next" : "later";
}

const STATE_PILL: Record<ClassState, { label: string; tone: PillTone }> = {
  done: { label: "Completed", tone: "neutral" },
  now: { label: "In progress", tone: "done" },
  next: { label: "Up next", tone: "accent" },
  later: { label: "Upcoming", tone: "open" },
  cancelled: { label: "Cancelled", tone: "warn" },
};

function SetupChecklist() {
  const plan = usePlanContext();
  const { schedule, life, isDemo } = useSchedule();
  if (isDemo || life.setup.hidden) return null;
  const steps = [
    { id: "courses", label: "Mark the courses you're taking now", done: plan.inProgress.size > 0, href: "/courses" },
    { id: "timetable", label: "Add your weekly timetable", done: schedule.sessions.length > 0, href: "/timetable" },
    { id: "deadlines", label: "Add your deadlines and exams", done: schedule.tasks.length > 0, href: "/tasks" },
    { id: "attendance", label: "Set your attendance rule", done: life.attendance.rule !== "none", href: "/settings" },
    { id: "reminders", label: "Turn on browser reminders", done: life.browserNotifications, href: "/settings" },
  ];
  const open = steps.filter((s) => !s.done && !life.setup.skipped.includes(s.id));
  if (open.length === 0) return null;
  const finished = steps.filter((s) => s.done).length;
  const update = useAppStore.getState().updateLife;
  return (
    <section aria-labelledby="setup-title" className="mt-6 rounded-2xl border border-accent/30 bg-accent-soft p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="setup-title" className="text-[15px] font-semibold text-fg">
            Get the most out of UniPath
          </h2>
          <p className="text-[13px] text-muted">
            Optional — {finished} of {steps.length} done. Skip anything you don&apos;t need.
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => update((l) => ({ ...l, setup: { ...l.setup, hidden: true } }))}>
          <X /> Hide
        </Button>
      </div>
      <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {open.map((s) => (
          <li key={s.id} className="flex items-center gap-2 rounded-xl border border-line bg-bg/50 px-3 py-2">
            <Circle aria-hidden className="size-4 shrink-0 text-accent" />
            <Link href={s.href} className="min-w-0 flex-1 text-sm font-medium text-fg hover:text-accent">
              {s.label}
            </Link>
            <button
              type="button"
              onClick={() => update((l) => ({ ...l, setup: { ...l.setup, skipped: [...l.setup.skipped, s.id] } }))}
              className="text-[12.5px] text-muted hover:text-fg"
            >
              Skip
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TodayCard() {
  const { today, zoned, nextClass, title, schedule } = useSchedule();
  const { openItem, dialogs } = useItemOpener();
  const items = agendaItems(schedule, zoned.date, zoned.date, title).filter((i) => i.kind === "class");
  const nextId = nextClass && nextClass.occurrence.date === zoned.date ? nextClass.occurrence.id : null;
  const current = today.find((o) => classState(o, zoned.minutes, nextId) === "now");
  const focus = current ?? (nextClass?.occurrence ?? null);
  const focusIsToday = focus?.date === zoned.date;

  if (!schedule.term || schedule.sessions.length === 0) {
    return (
      <Card className="lg:col-span-2" aria-labelledby="today-title">
        <CardHeader titleId="today-title" title="Today's classes" />
        <CardBody>
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-line-strong px-4 py-5">
            <Clock aria-hidden className="size-6 text-accent" />
            <p className="min-w-0 flex-1 text-sm text-muted">Add your weekly timetable to see today&apos;s classes, where they are, and a countdown to the next one.</p>
            <Button asChild>
              <Link href="/timetable">
                <Plus /> Add timetable
              </Link>
            </Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="lg:col-span-2" aria-labelledby="today-title">
      <CardHeader titleId="today-title" title="Today's classes" action={<Link href="/timetable" className="text-[13px] font-medium text-accent">Timetable</Link>} />
      <CardBody className="space-y-4">
        {focus && (
          <div className="rounded-2xl border border-accent/35 bg-accent-soft p-4" data-testid="next-class">
            <p className="text-[12.5px] font-medium text-accent">
              {current
                ? `Happening now · ends in ${formatDuration(toMinutes(current.end) - zoned.minutes)}`
                : focusIsToday
                  ? `Your next class · starts in ${formatDuration(minutesUntil(zoned, focus.date, focus.start))}`
                  : `Your next class · ${relativeDay(focus.date, zoned.date)}`}
            </p>
            <p className="mt-1 text-xl font-semibold tracking-tight text-fg">{title(focus.courseCode)}</p>
            <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
              <span className="inline-flex items-center gap-1.5">
                <Clock aria-hidden className="size-4" />
                {!focusIsToday && `${formatDate(focus.date)} · `}
                {formatTimeRange(focus.start, focus.end)}
              </span>
              {locationLine(focus) && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin aria-hidden className="size-4" /> {locationLine(focus)}
                </span>
              )}
              {focus.professor && <span>{focus.professor}</span>}
            </p>
            {(focus.building || focus.room) && (
              <Button asChild size="sm" className="mt-3">
                <Link href={`/campus?q=${encodeURIComponent([focus.building, focus.room].filter(Boolean).join(" "))}`}>
                  <Compass /> Find classroom
                </Link>
              </Button>
            )}
          </div>
        )}
        {items.length === 0 ? (
          <p className="text-sm text-muted">No classes today.</p>
        ) : (
          <ul className="space-y-1.5" aria-label="Today's classes">
            {items.map((i) => {
              const state = classState(i.occurrence!, zoned.minutes, nextId);
              return (
                <li key={i.id} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <AgendaRow item={i} onOpen={openItem} />
                  </div>
                  <Pill tone={STATE_PILL[state].tone} className="hidden sm:inline-flex">
                    {STATE_PILL[state].label}
                  </Pill>
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
      {dialogs}
    </Card>
  );
}

function PrioritiesCard() {
  const s = useSchedule();
  const priorities = todaysPriorities({ now: s.zoned, ranked: s.ranked, alerts: s.alerts, nextClass: s.nextClass, title: s.title });
  return (
    <Card className="lg:col-span-2" aria-labelledby="prio-title">
      <CardHeader titleId="prio-title" title="Today's priorities" />
      <CardBody>
        {priorities.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted">
            <CheckCircle2 aria-hidden className="size-4 text-done" /> Nothing urgent. Nice.
          </p>
        ) : (
          <ol className="space-y-2" data-testid="priorities">
            {priorities.map((p) => (
              <li key={p.id}>
                <Link href={p.href} className="flex items-start gap-3 rounded-xl border border-line bg-bg/40 px-3 py-2.5 hover:border-line-strong">
                  <span
                    aria-hidden
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      p.level === "critical" ? "bg-danger" : p.level === "high" ? "bg-warn" : p.level === "medium" ? "bg-open" : "bg-lock",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-fg">{p.title}</span>
                    {p.detail && <span className="block truncate text-[12.5px] text-muted">{p.detail}</span>}
                  </span>
                  <ArrowRight aria-hidden className="mt-1 size-4 shrink-0 text-dim" />
                </Link>
              </li>
            ))}
          </ol>
        )}
      </CardBody>
    </Card>
  );
}

function DeadlinesCard() {
  const { ranked, zoned, title } = useSchedule();
  const [adding, setAdding] = useState(false);
  const soon = ranked
    .filter((r) => !r.task.done && (r.overdue || r.task.dueDate <= addDays(zoned.date, 14)))
    .sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.minutesLeft - b.minutesLeft)
    .slice(0, 7);
  return (
    <Card className="lg:col-span-2" aria-labelledby="dl-title">
      <CardHeader
        titleId="dl-title"
        title="Upcoming deadlines"
        action={
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setAdding(true)} className="text-[13px] font-medium text-accent">
              Add
            </button>
            <Link href="/tasks" className="text-[13px] font-medium text-accent">
              All tasks
            </Link>
          </div>
        }
      />
      <CardBody>
        {soon.length === 0 ? (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-line-strong px-4 py-4">
            <ListTodo aria-hidden className="size-5 text-accent" />
            <p className="min-w-0 flex-1 text-sm text-muted">Nothing due in the next two weeks.</p>
            <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
              <Plus /> Add a deadline
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-line" data-testid="deadlines">
            {soon.map((r) => {
              const t = r.task;
              return (
                <li key={t.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                  <input
                    type="checkbox"
                    checked={t.done}
                    onChange={(e) => useAppStore.getState().setTaskDone(t.id, e.target.checked)}
                    aria-label={`${t.title} done`}
                    className="mt-1 size-4 shrink-0 accent-[var(--accent)]"
                  />
                  <span aria-hidden className={cn("mt-2 size-2 shrink-0 rounded-full", GROUP_META[taskGroup(t.type)].dot)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-fg">{t.title}</p>
                    <p className="text-[12.5px] text-muted">
                      {TASK_TYPE_LABEL[t.type]}
                      {t.courseCode && ` · ${title(t.courseCode)}`}
                      {r.progress > 0 && ` · ${r.progress}% done`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={cn("text-[13px] font-medium", r.overdue ? "text-warn" : "text-fg")}>
                      {r.overdue ? "Overdue" : r.minutesLeft < 24 * 60 ? `${formatDuration(r.minutesLeft)} left` : relativeDay(t.dueDate, zoned.date)}
                    </p>
                    <p className="text-[12px] text-muted">
                      {formatDate(t.dueDate)}
                      {t.dueTime && ` · ${formatTime(t.dueTime)}`}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
      {adding && <TaskDialog open onOpenChange={setAdding} />}
    </Card>
  );
}

function WeekCard() {
  const { schedule, zoned, title, flagged } = useSchedule();
  const days = Array.from({ length: 7 }, (_, i) => addDays(zoned.date, i));
  const items = agendaItems(schedule, days[0], days[6], title).filter((i) => !i.inactive);
  return (
    <Card aria-labelledby="week-title">
      <CardHeader titleId="week-title" title="The next 7 days" action={<Link href="/calendar" className="text-[13px] font-medium text-accent">Calendar</Link>} />
      <CardBody>
        <ul className="space-y-1">
          {days.map((d) => {
            const list = items.filter((i) => i.date === d);
            const notable = list.filter((i) => i.kind !== "class");
            const classes = list.length - notable.length;
            const warn = list.some((i) => flagged.has(i.ref.id));
            return (
              <li key={d}>
                <Link href={`/calendar?date=${d}`} className="flex items-start gap-3 rounded-xl px-2 py-1.5 hover:bg-surface-2/60">
                  <span className="w-[70px] shrink-0 pt-0.5 text-[12.5px] font-medium text-muted">{d === zoned.date ? "Today" : formatDate(d, { weekday: "short", day: "numeric" })}</span>
                  <span className="min-w-0 flex-1 text-[13px]">
                    {notable.length === 0 ? (
                      <span className="text-dim">{classes ? plural(classes, "class", "classes") : "Free"}</span>
                    ) : (
                      notable.slice(0, 2).map((i) => (
                        <span key={i.id} className="flex items-center gap-1.5 truncate text-fg">
                          <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", GROUP_META[itemGroup(i)].dot)} />
                          <span className="truncate">{i.title}</span>
                        </span>
                      ))
                    )}
                    {notable.length > 2 && <span className="block text-[12px] text-muted">+{notable.length - 2} more</span>}
                  </span>
                  {warn && <TriangleAlert aria-label="Has a conflict" className="mt-0.5 size-3.5 shrink-0 text-warn" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </CardBody>
    </Card>
  );
}

function AcademicCard() {
  const plan = usePlanContext();
  const { progress, roadmap, settings } = plan;
  const { scale, result: gpa, inputs, policy } = useGpa();
  const university = getUniversity(plan.curriculum.universityId);
  const predicted = inputs && Object.keys(plan.record.forecast.expected).length ? forecastCgpa(inputs, plan.record.forecast.expected, policy).cgpa : null;
  const current = [...plan.inProgress].map((c) => plan.index.byCode.get(c)!).filter(Boolean);
  return (
    <Card aria-labelledby="academic-title" className="lg:row-span-2">
      <CardHeader titleId="academic-title" title={plan.curriculum.majorName} description={`${plan.curriculum.degree} · ${university?.name ?? ""}`} />
      <CardBody className="space-y-4">
        {scale && (
          <div className="space-y-1.5">
            <Link href="/gpa" className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-xl border border-line bg-surface-2/40 px-3 py-2.5 text-sm hover:border-line-strong">
              <Gauge aria-hidden className="size-4 text-accent" />
              {gpa?.cgpa != null ? (
                <>
                  <span className="text-muted">CGPA</span>
                  <span className="num font-semibold text-fg">{gpa.cgpa.toFixed(2)}</span>
                  {gpa.rating && <Pill tone={RATING_TONE[gpa.rating] ?? "neutral"}>{gpa.rating}</Pill>}
                </>
              ) : (
                <span className="text-muted">Add your grades to see your GPA</span>
              )}
              <ArrowRight aria-hidden className="ml-auto size-4 text-dim" />
            </Link>
            {predicted !== null && (
              <Link href="/gpa#forecast-title" className="block px-1 text-[13px] text-muted hover:text-fg">
                Predicted after this semester: <span className="num font-medium text-fg">{predicted.toFixed(2)}</span> <span className="text-dim">(your expected grades)</span>
              </Link>
            )}
          </div>
        )}
        <div>
          <p className="flex items-baseline justify-between gap-2">
            <span className="text-sm text-muted">
              <span className="num text-2xl font-semibold text-fg">{progress.countedCredits}</span> of {progress.totalCredits} credit hours
            </span>
            <span className="num text-lg font-semibold text-accent">{progress.percent}%</span>
          </p>
          <ProgressBar
            className="mt-2"
            value={progress.countedCredits}
            max={progress.totalCredits}
            label={`Degree progress: ${progress.countedCredits} of ${progress.totalCredits} credit hours`}
          />
        </div>
        <div className="flex items-start gap-2.5 text-sm">
          <GraduationCap aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
          <p className="text-muted">
            Estimated graduation:{" "}
            {progress.complete ? (
              <span className="text-done">requirements complete</span>
            ) : roadmap.graduationTerm ? (
              <span className="font-medium text-fg">{roadmap.semesters.at(-1)!.label}</span>
            ) : (
              <span className="text-warn">needs a planning fix</span>
            )}
            {!progress.complete && roadmap.graduationTerm && (
              <span className="block text-[12.5px]">
                About {plural(roadmap.semesterCount, "semester")} left at up to {settings.maxCredits} credits.
              </span>
            )}
          </p>
        </div>
        <div>
          <p className="mb-1 flex items-center gap-1.5 text-[13px] font-medium text-fg">
            <Hourglass aria-hidden className="size-3.5 text-now" /> This semester
          </p>
          {current.length === 0 ? (
            <Link href="/courses" className="text-[13px] text-accent">
              Mark the courses you&apos;re taking
            </Link>
          ) : (
            <ul className="space-y-0.5 text-[13px] text-muted">
              {current.map((c) => (
                <li key={c.code} className="truncate">
                  {c.title}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button asChild size="sm">
            <Link href="/planner">
              Plan my next semester <ArrowRight />
            </Link>
          </Button>
          <Button asChild size="sm" variant="secondary">
            <Link href="/gpa">GPA forecast</Link>
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function InsightCard({ onOpenCourse }: { onOpenCourse: (code: string) => void }) {
  const { insight } = usePlanContext();
  const { alerts } = useSchedule();
  const top = alerts.slice(0, 2);
  return (
    <Card aria-labelledby="insight-title">
      <CardHeader
        titleId="insight-title"
        title="Worth knowing"
        action={alerts.length > 2 ? <Link href="/notifications" className="text-[13px] font-medium text-accent">All {alerts.length}</Link> : undefined}
      />
      <CardBody className="space-y-2.5">
        {top.map((a) => (
          <AlertCard key={a.id} alert={a} compact />
        ))}
        {top.length < 2 && insight && (
          <div className="rounded-2xl border border-line bg-bg/40 p-3.5">
            <p className="flex gap-2.5 text-sm leading-relaxed text-fg">
              <Lightbulb aria-hidden className="mt-0.5 size-4 shrink-0 text-warn" />
              {insight.message}
            </p>
            <button type="button" onClick={() => onOpenCourse(insight.code)} className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-accent">
              Open {insight.title} <ArrowRight aria-hidden className="size-3.5" />
            </button>
          </div>
        )}
        {top.length === 0 && !insight && <p className="text-sm text-muted">Nothing needs your attention right now.</p>}
      </CardBody>
    </Card>
  );
}

export function OverviewScreen() {
  const plan = usePlanContext();
  const { zoned, today, ranked } = useSchedule();
  const [openCode, setOpenCode] = useState<string | null>(null);
  const classesToday = today.filter((o) => o.status === "scheduled").length;
  const classesLeft = today.filter((o) => o.status === "scheduled" && toMinutes(o.end) > zoned.minutes).length;
  const dueToday = ranked.filter((r) => !r.task.done && r.task.dueDate === zoned.date).length;
  const noneCompleted = plan.completed.size === 0;

  return (
    <div className="page-in mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-fg sm:text-[30px]">{greeting(zoned.minutes)}!</h1>
        <p className="mt-1.5 text-[15px] text-muted">
          {formatDate(zoned.date, { weekday: "long", day: "numeric", month: "long" })} ·{" "}
          {classesToday === 0
            ? "No classes today"
            : classesLeft === 0
              ? `All of today's classes are done`
              : classesLeft === classesToday
                ? `You have ${plural(classesToday, "class", "classes")} today`
                : `${plural(classesLeft, "class", "classes")} left today`}
          {dueToday > 0 && ` and ${plural(dueToday, "deadline")}`}.
        </p>
      </div>

      <SetupChecklist />

      {noneCompleted && (
        <div className="mt-6 flex flex-wrap items-center gap-4 rounded-2xl border border-accent/30 bg-accent-soft px-5 py-4">
          <ListChecks aria-hidden className="size-6 text-accent" />
          <p className="min-w-0 flex-1 text-sm text-fg">
            <span className="font-semibold">No completed courses yet.</span>{" "}
            <span className="text-muted">Mark the courses you&apos;ve already finished to see your personalized plan. New students can skip this.</span>
          </p>
          <Button asChild variant="secondary">
            <Link href="/courses">Mark completed courses</Link>
          </Button>
        </div>
      )}

      {plan.progress.unknownCodes.length > 0 && (
        <p role="status" className="mt-6 rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-sm text-fg">
          {plural(plan.progress.unknownCodes.length, "saved course")} ({plan.progress.unknownCodes.join(", ")}) aren&apos;t part of this study plan, so they
          aren&apos;t counted. They&apos;re still saved.
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <TodayCard />
        <AcademicCard />
        <PrioritiesCard />
        <DeadlinesCard />
        <InsightCard onOpenCourse={setOpenCode} />
        <WeekCard />
      </div>

      <p className="mt-6 flex items-center gap-2 text-[12.5px] text-dim">
        <CalendarDays aria-hidden className="size-3.5" /> Times use {zoned.timeZone.replace(/_/g, " ")}. Change it in{" "}
        <Link href="/settings" className="text-accent">
          Settings
        </Link>
        .
      </p>
      <CourseDetailDialog code={openCode} onChange={setOpenCode} />
    </div>
  );
}
