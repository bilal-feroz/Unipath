"use client";

import { CalendarCog, CalendarPlus, Clock, Plus, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/app-shell";
import { usePlanContext } from "@/components/app-shell/plan-context";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/form";
import { Pill } from "@/components/ui/pill";
import { locationLine } from "@/lib/schedule/occurrences";
import { SESSION_KIND_LABEL, type ExtraClass, type Session } from "@/lib/schedule/schema";
import { formatDate, formatTime, formatTimeRange, toMinutes, WEEKDAY_LONG, WEEKDAY_SHORT } from "@/lib/schedule/time";
import { useAppStore } from "@/lib/state/store";
import { cn } from "@/lib/utils";
import { ClassDialog, MakeupDialog, TermDialog } from "./class-dialogs";
import { useSchedule } from "./schedule-context";

const PX_PER_MIN = 1;

function WeekGrid({ sessions, onOpen, flagged }: { sessions: Session[]; onOpen: (s: Session) => void; flagged: Set<string> }) {
  const { title } = useSchedule();
  const used = new Set(sessions.flatMap((s) => s.days));
  const days = [1, 2, 3, 4, 5, 6, 7].filter((d) => d <= 5 || used.has(d));
  const startHour = Math.min(8, ...sessions.map((s) => Math.floor(toMinutes(s.start) / 60)));
  const endHour = Math.max(17, ...sessions.map((s) => Math.ceil(toMinutes(s.end) / 60)));
  const height = (endHour - startHour) * 60 * PX_PER_MIN;
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);

  return (
    <div className="overflow-x-auto overflow-y-hidden py-2">
      <div className="grid min-w-[640px]" style={{ gridTemplateColumns: `48px repeat(${days.length}, minmax(0, 1fr))` }}>
        <div />
        {days.map((d) => (
          <p key={d} className="pb-2 text-center text-[13px] font-medium text-muted">
            {WEEKDAY_SHORT[d - 1]}
          </p>
        ))}
        <div className="relative" style={{ height }}>
          {hours.map((h) => (
            <span key={h} className="num absolute -translate-y-1/2 text-[11px] text-dim" style={{ top: (h - startHour) * 60 * PX_PER_MIN }}>
              {formatTime(`${String(h).padStart(2, "0")}:00`).replace(":00", "")}
            </span>
          ))}
        </div>
        {days.map((d) => {
          const list = sessions.filter((s) => s.days.includes(d)).sort((a, b) => a.start.localeCompare(b.start));
          // Side by side when classes overlap.
          const lanes: Session[][] = [];
          for (const s of list) {
            const lane = lanes.find((l) => toMinutes(l.at(-1)!.end) <= toMinutes(s.start));
            if (lane) lane.push(s);
            else lanes.push([s]);
          }
          return (
            <div key={d} className="relative border-l border-line" style={{ height }}>
              {hours.map((h) => (
                <div key={h} className="absolute inset-x-0 border-t border-line/60" style={{ top: (h - startHour) * 60 * PX_PER_MIN }} />
              ))}
              {lanes.flatMap((lane, li) =>
                lane.map((s) => {
                  const top = (toMinutes(s.start) - startHour * 60) * PX_PER_MIN;
                  const h = (toMinutes(s.end) - toMinutes(s.start)) * PX_PER_MIN;
                  return (
                    <button
                      key={`${s.id}-${d}`}
                      type="button"
                      onClick={() => onOpen(s)}
                      className={cn(
                        "absolute overflow-hidden rounded-lg border border-l-[3px] border-open/40 border-l-open bg-open-soft px-1.5 py-1 text-left text-[11.5px] leading-tight text-fg hover:border-open",
                        flagged.has(s.id) && "ring-1 ring-warn",
                      )}
                      style={{ top, height: h, left: `calc(${(li / lanes.length) * 100}% + 3px)`, width: `calc(${100 / lanes.length}% - 6px)` }}
                    >
                      <span className="block truncate font-semibold">{title(s.courseCode)}</span>
                      <span className="num block truncate text-muted">{formatTimeRange(s.start, s.end)}</span>
                      {(s.room || s.building) && <span className="block truncate text-muted">{[s.building, s.room && `Rm ${s.room}`].filter(Boolean).join(" · ")}</span>}
                    </button>
                  );
                }),
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayList({ sessions, onOpen }: { sessions: Session[]; onOpen: (s: Session) => void }) {
  const { title } = useSchedule();
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5, 6, 7].map((d) => {
        const list = sessions.filter((s) => s.days.includes(d)).sort((a, b) => a.start.localeCompare(b.start));
        if (list.length === 0) return null;
        return (
          <div key={d}>
            <h3 className="mb-1.5 text-[13px] font-medium text-muted">{WEEKDAY_LONG[d - 1]}</h3>
            <ul className="space-y-1.5">
              {list.map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => onOpen(s)} className="flex w-full items-start gap-3 rounded-xl border border-l-[3px] border-line border-l-open bg-bg/40 px-3 py-2.5 text-left">
                    <span className="num w-[92px] shrink-0 pt-0.5 text-[12.5px] text-muted">{formatTimeRange(s.start, s.end)}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{title(s.courseCode)}</span>
                      <span className="block truncate text-[12.5px] text-muted">
                        {SESSION_KIND_LABEL[s.kind]}
                        {locationLine(s) && ` · ${locationLine(s)}`}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export function TimetableScreen() {
  const plan = usePlanContext();
  const { schedule, title, alerts, flagged } = useSchedule();
  const [dialog, setDialog] = useState<
    { type: "class"; session: Session | null; course: string | null } | { type: "makeup"; extra: ExtraClass | null } | { type: "term" } | null
  >(null);
  const term = schedule.term;
  const sessions = schedule.sessions;
  const scheduled = new Set(sessions.map((s) => s.courseCode));
  const missing = [...plan.inProgress].filter((c) => !scheduled.has(c));
  const byCourse = [...new Set(sessions.map((s) => s.courseCode))];
  const clashes = alerts.filter((a) => a.rule === "class-overlap" || a.rule === "travel");
  const changes = [...schedule.exceptions].sort((a, b) => a.date.localeCompare(b.date));
  const close = (v: boolean) => !v && setDialog(null);

  return (
    <div className="page-in mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Timetable"
        description={term ? `${term.name} · ${formatDate(term.start)} – ${formatDate(term.end)}` : "Your weekly classes this semester."}
        action={
          term && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setDialog({ type: "term" })}>
                <CalendarCog /> Semester dates
              </Button>
              <Button variant="secondary" onClick={() => setDialog({ type: "makeup", extra: null })}>
                <CalendarPlus /> Makeup class
              </Button>
              <Button onClick={() => setDialog({ type: "class", session: null, course: null })}>
                <Plus /> Add class
              </Button>
            </div>
          )
        }
      />

      {!term ? (
        <EmptyState
          className="mt-6"
          icon={<Clock />}
          title="Start with your semester dates"
          action={<Button onClick={() => setDialog({ type: "term" })}>Set semester dates</Button>}
        >
          Weekly classes repeat between the first and last day of classes. Use the dates from your university&apos;s
          academic calendar.
        </EmptyState>
      ) : (
        <div className="mt-6 space-y-4">
          {missing.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-accent/30 bg-accent-soft px-4 py-3 text-sm">
              <span className="text-fg">You&apos;re taking these this semester. Add when they meet:</span>
              {missing.map((c) => (
                <Button key={c} size="sm" variant="secondary" onClick={() => setDialog({ type: "class", session: null, course: c })}>
                  <Plus /> {title(c)}
                </Button>
              ))}
            </div>
          )}
          {clashes.length > 0 && (
            <ul className="space-y-2">
              {clashes.map((a) => (
                <li key={a.id} className="flex gap-3 rounded-2xl border border-warn/35 bg-warn-soft px-4 py-3 text-sm">
                  <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warn" />
                  <span>
                    <span className="font-semibold text-fg">{a.title}.</span> <span className="text-muted">{a.why}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {sessions.length === 0 ? (
            <EmptyState
              icon={<Clock />}
              title="No classes yet"
              action={<Button onClick={() => setDialog({ type: "class", session: null, course: missing[0] ?? null })}>Add your first class</Button>}
            >
              {plan.inProgress.size === 0 ? (
                <>
                  Tip: mark the courses you&apos;re taking now in <Link href="/courses" className="text-accent">My Courses</Link> (the
                  hourglass), and they&apos;ll be suggested here.
                </>
              ) : (
                "Add each lecture, lab and tutorial once. UniPath repeats them every week."
              )}
            </EmptyState>
          ) : (
            <Card aria-labelledby="week-title">
              <CardHeader titleId="week-title" title="This week" />
              <CardBody>
                <div className="hidden md:block">
                  <WeekGrid sessions={sessions} flagged={flagged} onOpen={(s) => setDialog({ type: "class", session: s, course: null })} />
                </div>
                <div className="md:hidden">
                  <DayList sessions={sessions} onOpen={(s) => setDialog({ type: "class", session: s, course: null })} />
                </div>
              </CardBody>
            </Card>
          )}

          {byCourse.length > 0 && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card aria-labelledby="courses-title">
                <CardHeader titleId="courses-title" title="Your classes" description="Tap a class to edit it." />
                <CardBody>
                  <ul className="divide-y divide-line">
                    {byCourse.map((code) => (
                      <li key={code} className="py-2.5 first:pt-0 last:pb-0">
                        <p className="text-sm font-medium text-fg">{title(code)}</p>
                        <ul className="mt-1 space-y-0.5">
                          {sessions
                            .filter((s) => s.courseCode === code)
                            .map((s) => (
                              <li key={s.id}>
                                <button type="button" onClick={() => setDialog({ type: "class", session: s, course: null })} className="text-left text-[13px] text-muted hover:text-fg">
                                  {SESSION_KIND_LABEL[s.kind]} · {s.days.map((d) => WEEKDAY_SHORT[d - 1]).join(", ")} · {formatTimeRange(s.start, s.end)}
                                  {locationLine(s) && ` · ${locationLine(s)}`}
                                  {s.professor && ` · ${s.professor}`}
                                </button>
                              </li>
                            ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
              <Card aria-labelledby="changes-title">
                <CardHeader titleId="changes-title" title="Changes and makeup classes" description="Cancel or move a single class from the calendar." />
                <CardBody>
                  {changes.length === 0 && schedule.extras.length === 0 ? (
                    <p className="text-sm text-muted">No changes this semester.</p>
                  ) : (
                    <ul className="divide-y divide-line text-sm">
                      {changes.map((x) => {
                        const s = sessions.find((y) => y.id === x.sessionId);
                        return (
                          <li key={x.id} className="flex items-center gap-3 py-2 first:pt-0">
                            <Pill tone={x.type === "cancelled" ? "warn" : "open"}>{x.type === "cancelled" ? "Cancelled" : "Moved"}</Pill>
                            <span className="min-w-0 flex-1 truncate">
                              {s ? title(s.courseCode) : "Class"} · {formatDate(x.date)}
                              {x.type === "moved" && x.toDate && ` → ${formatDate(x.toDate)}${x.start ? ` ${formatTime(x.start)}` : ""}`}
                            </span>
                            <Button size="sm" variant="ghost" onClick={() => useAppStore.getState().deleteException(x.id)}>
                              Undo
                            </Button>
                          </li>
                        );
                      })}
                      {schedule.extras.map((x) => (
                        <li key={x.id} className="flex items-center gap-3 py-2 first:pt-0">
                          <Pill tone="done">Makeup</Pill>
                          <span className="min-w-0 flex-1 truncate">
                            {title(x.courseCode)} · {formatDate(x.date)} {formatTime(x.start)}
                          </span>
                          <Button size="sm" variant="ghost" onClick={() => setDialog({ type: "makeup", extra: x })}>
                            Edit
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardBody>
              </Card>
            </div>
          )}
        </div>
      )}

      {dialog?.type === "class" && <ClassDialog open onOpenChange={close} session={dialog.session} defaultCourse={dialog.course} />}
      {dialog?.type === "makeup" && <MakeupDialog open onOpenChange={close} extra={dialog.extra} />}
      {dialog?.type === "term" && <TermDialog open onOpenChange={close} term={term} />}
    </div>
  );
}
