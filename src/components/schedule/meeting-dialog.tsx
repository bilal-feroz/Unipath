"use client";

import { CalendarX, Compass, Pencil, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/form";
import { isPast } from "@/lib/schedule/attendance";
import { locationLine, type ClassOccurrence } from "@/lib/schedule/occurrences";
import { ATTENDANCE_MARKS, newId, SESSION_KIND_LABEL, type AttendanceMark } from "@/lib/schedule/schema";
import { formatDate, formatTimeRange, isValidDate, toMinutes } from "@/lib/schedule/time";
import { useAppStore } from "@/lib/state/store";
import { cn } from "@/lib/utils";
import { ClassDialog, MakeupDialog } from "./class-dialogs";
import { useSchedule } from "./schedule-context";

export const MARK_LABEL: Record<AttendanceMark, string> = { present: "Present", absent: "Absent", late: "Late", excused: "Excused" };
export const MARK_TONE: Record<AttendanceMark, string> = {
  // The page background as text colour stays readable on these solid colours in both themes.
  present: "border-done bg-done text-bg",
  absent: "border-danger bg-danger text-bg",
  late: "border-now bg-now text-bg",
  excused: "border-lock bg-lock text-bg",
};

/** Buttons to record attendance for one class meeting. */
export function AttendanceButtons({ occurrenceId, compact }: { occurrenceId: string; compact?: boolean }) {
  const { schedule } = useSchedule();
  const mark = schedule.attendance[occurrenceId];
  return (
    <div role="group" aria-label="Attendance" className="flex flex-wrap gap-1.5">
      {ATTENDANCE_MARKS.map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={mark === m}
          onClick={() => useAppStore.getState().markAttendance(occurrenceId, mark === m ? null : m)}
          className={cn(
            "rounded-lg border font-medium transition-colors",
            compact ? "h-8 px-2.5 text-[12.5px]" : "h-9 px-3 text-[13px]",
            mark === m ? MARK_TONE[m] : "border-line bg-bg/60 text-muted hover:text-fg",
          )}
        >
          {MARK_LABEL[m]}
        </button>
      ))}
    </div>
  );
}

/** Details and actions for one meeting of a class. */
export function MeetingDialog({ occurrence, onOpenChange }: { occurrence: ClassOccurrence | null; onOpenChange: (open: boolean) => void }) {
  const { schedule, title, zoned } = useSchedule();
  const [mode, setMode] = useState<"view" | "move">("view");
  const [edit, setEdit] = useState<"class" | "makeup" | null>(null);
  const o = occurrence;
  const [move, setMove] = useState(() => ({ date: o?.date ?? "", start: o?.start ?? "", end: o?.end ?? "", building: o?.building ?? "", room: o?.room ?? "" }));
  if (!o) return null;
  const session = o.sessionId ? schedule.sessions.find((s) => s.id === o.sessionId) ?? null : null;
  const extra = o.makeup ? schedule.extras.find((x) => `extra:${x.id}` === o.id) ?? null : null;
  const past = isPast(o, zoned) || o.date === zoned.date;
  const moveError = !isValidDate(move.date) ? "Choose a date." : !move.start || !move.end || toMinutes(move.end) <= toMinutes(move.start) ? "The class must end after it starts." : null;
  const close = () => onOpenChange(false);

  if (edit === "class" && session) return <ClassDialog open onOpenChange={(v) => !v && close()} session={session} />;
  if (edit === "makeup" && extra) return <MakeupDialog open onOpenChange={(v) => !v && close()} extra={extra} />;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent
        title={title(o.courseCode)}
        description={`${SESSION_KIND_LABEL[o.kind]} · ${formatDate(o.date, { weekday: "long", day: "numeric", month: "long" })} · ${formatTimeRange(o.start, o.end)}`}
      >
        {mode === "view" ? (
          <div className="space-y-5">
            {(o.status !== "scheduled" || o.moved || o.makeup) && (
              <p className="rounded-xl border border-warn/30 bg-warn-soft px-3 py-2 text-sm text-fg">
                {o.status === "cancelled"
                  ? `Cancelled${o.note ? `: ${o.note}` : "."}`
                  : o.status === "holiday"
                    ? `No class: ${o.holidayName}.`
                    : o.moved
                      ? `Moved from ${formatDate(o.originalDate!)} at ${formatTimeRange(o.originalStart, null)}.`
                      : `One-off class${o.note ? `: ${o.note}` : "."}`}
              </p>
            )}
            <dl className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-1.5 text-sm">
              <dt className="text-muted">Where</dt>
              <dd className="text-fg">{locationLine(o) || "Not set"}</dd>
              <dt className="text-muted">Professor</dt>
              <dd className="text-fg">{o.professor || "Not set"}</dd>
            </dl>
            {o.status === "scheduled" && past && (
              <div>
                <p className="mb-1.5 text-[13px] font-medium text-fg">Attendance</p>
                <AttendanceButtons occurrenceId={o.id} />
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {(o.building || o.room) && (
                <Button asChild variant="secondary" size="sm">
                  <Link href={`/campus?q=${encodeURIComponent([o.building, o.room].filter(Boolean).join(" "))}`} onClick={close}>
                    <Compass /> Find classroom
                  </Link>
                </Button>
              )}
              {session && !o.exceptionId && o.status === "scheduled" && (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      useAppStore.getState().saveException({ id: newId("change"), sessionId: session.id, date: o.date, type: "cancelled", toDate: null, start: null, end: null, building: null, room: null, note: "" });
                      toast("Class cancelled for that day");
                      close();
                    }}
                  >
                    <CalendarX /> Cancel this class
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setMode("move")}>
                    <Pencil /> Reschedule
                  </Button>
                </>
              )}
              {o.exceptionId && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    useAppStore.getState().deleteException(o.exceptionId!);
                    toast("Back to the usual time");
                    close();
                  }}
                >
                  <RotateCcw /> Undo change
                </Button>
              )}
              {session && (
                <Button variant="ghost" size="sm" onClick={() => setEdit("class")}>
                  Edit weekly class
                </Button>
              )}
              {extra && (
                <Button variant="ghost" size="sm" onClick={() => setEdit("makeup")}>
                  Edit
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted">Only this meeting moves. The weekly class stays the same.</p>
            <div className="grid grid-cols-3 gap-3">
              <Field label="New date" error={moveError}>
                {(id) => <Input id={id} type="date" value={move.date} onChange={(e) => setMove({ ...move, date: e.target.value })} />}
              </Field>
              <Field label="Starts">{(id) => <Input id={id} type="time" value={move.start} onChange={(e) => setMove({ ...move, start: e.target.value })} />}</Field>
              <Field label="Ends">{(id) => <Input id={id} type="time" value={move.end} onChange={(e) => setMove({ ...move, end: e.target.value })} />}</Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Building">{(id) => <Input id={id} value={move.building} onChange={(e) => setMove({ ...move, building: e.target.value })} />}</Field>
              <Field label="Room">{(id) => <Input id={id} value={move.room} onChange={(e) => setMove({ ...move, room: e.target.value })} />}</Field>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setMode("view")}>
                Back
              </Button>
              <Button
                disabled={!!moveError}
                onClick={() => {
                  useAppStore.getState().saveException({
                    id: newId("change"),
                    sessionId: session!.id,
                    date: o.originalDate ?? o.date,
                    type: "moved",
                    toDate: move.date,
                    start: move.start,
                    end: move.end,
                    building: move.building !== session!.building ? move.building : null,
                    room: move.room !== session!.room ? move.room : null,
                    note: "",
                  });
                  toast("Class rescheduled", { description: "The calendar and conflict checks are updated." });
                  close();
                }}
              >
                Save new time
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
