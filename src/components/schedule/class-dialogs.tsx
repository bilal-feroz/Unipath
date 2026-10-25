"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { usePlanContext } from "@/components/app-shell/plan-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, NativeSelect, ToggleChips } from "@/components/ui/form";
import {
  newId,
  SESSION_KINDS,
  SESSION_KIND_LABEL,
  type ExtraClass,
  type Session,
  type SessionKind,
  type Term,
} from "@/lib/schedule/schema";
import { addDays, isValidDate, startOfWeek, toMinutes, WEEKDAY_LONG, WEEKDAY_SHORT, zonedNow } from "@/lib/schedule/time";
import { useAppStore } from "@/lib/state/store";
import { CourseSelect } from "./course-select";

const DAY_OPTIONS = WEEKDAY_SHORT.map((label, i) => ({ value: i + 1, label, title: WEEKDAY_LONG[i] }));

function timeError(start: string, end: string): string | null {
  if (!start || !end) return "Add a start and end time.";
  return toMinutes(end) > toMinutes(start) ? null : "The class must end after it starts.";
}

function LocationFields({
  value,
  onChange,
}: {
  value: { building: string; floor: string; room: string };
  onChange: (v: { building: string; floor: string; room: string }) => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_88px_110px] gap-3">
      <Field label="Building">{(id) => <Input id={id} value={value.building} onChange={(e) => onChange({ ...value, building: e.target.value })} placeholder="e.g. Building B" maxLength={80} />}</Field>
      <Field label="Floor">{(id) => <Input id={id} value={value.floor} onChange={(e) => onChange({ ...value, floor: e.target.value })} maxLength={20} />}</Field>
      <Field label="Room">{(id) => <Input id={id} value={value.room} onChange={(e) => onChange({ ...value, room: e.target.value })} maxLength={30} />}</Field>
    </div>
  );
}

/** Add or edit a weekly class (lecture, lab or tutorial). */
export function ClassDialog({
  open,
  onOpenChange,
  session,
  defaultCourse,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session?: Session | null;
  defaultCourse?: string | null;
}) {
  const plan = usePlanContext();
  const [form, setForm] = useState(() => ({
    courseCode: session?.courseCode ?? defaultCourse ?? null,
    kind: (session?.kind ?? "lecture") as SessionKind,
    days: session?.days ?? [],
    start: session?.start ?? "09:00",
    end: session?.end ?? "10:15",
    professor: session?.professor ?? "",
    building: session?.building ?? "",
    floor: session?.floor ?? "",
    room: session?.room ?? "",
    section: session?.section ?? "",
  }));
  const [markTaking, setMarkTaking] = useState(true);
  const [tried, setTried] = useState(false);
  const errors = {
    course: form.courseCode ? null : "Choose the course.",
    days: form.days.length ? null : "Pick at least one day.",
    time: timeError(form.start, form.end),
  };
  const valid = !errors.course && !errors.days && !errors.time;
  const notTaking = !!form.courseCode && !plan.inProgress.has(form.courseCode) && !plan.completed.has(form.courseCode);

  const save = () => {
    setTried(true);
    if (!valid) return;
    const store = useAppStore.getState();
    store.saveSession({ id: session?.id ?? newId("class"), ...form, courseCode: form.courseCode!, days: [...form.days].sort() });
    if (notTaking && markTaking) store.toggleInProgress(form.courseCode!);
    toast(session ? "Class updated" : "Class added", { description: "It's on your calendar and today's schedule." });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={session ? "Edit class" : "Add a class"}
        description="A lecture, lab or tutorial that repeats every week this semester."
        footer={
          <>
            {session && (
              <Button
                variant="danger"
                className="mr-auto"
                onClick={() => {
                  useAppStore.getState().deleteSession(session.id);
                  toast("Class removed");
                  onOpenChange(false);
                }}
              >
                <Trash2 /> Remove
              </Button>
            )}
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={save}>{session ? "Save" : "Add class"}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Course" error={tried ? errors.course : null}>
            {(id) => <CourseSelect id={id} value={form.courseCode} onChange={(courseCode) => setForm({ ...form, courseCode })} />}
          </Field>
          {notTaking && (
            <label className="flex items-center gap-2 text-[13px] text-muted">
              <input type="checkbox" checked={markTaking} onChange={(e) => setMarkTaking(e.target.checked)} className="size-4 accent-[var(--accent)]" />
              Also mark this course as taking this semester
            </label>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              {(id) => (
                <NativeSelect id={id} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as SessionKind })}>
                  {SESSION_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {SESSION_KIND_LABEL[k]}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
            <Field label="Section (optional)">{(id) => <Input id={id} value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} maxLength={20} />}</Field>
          </div>
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-fg">Days</p>
            <ToggleChips label="Days" options={DAY_OPTIONS} value={form.days} onChange={(days) => setForm({ ...form, days })} />
            {tried && errors.days && (
              <p role="alert" className="mt-1 text-[12px] text-danger">
                {errors.days}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Starts" error={tried ? errors.time : null}>
              {(id) => <Input id={id} type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />}
            </Field>
            <Field label="Ends">{(id) => <Input id={id} type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />}</Field>
          </div>
          <Field label="Professor (optional)">{(id) => <Input id={id} value={form.professor} onChange={(e) => setForm({ ...form, professor: e.target.value })} maxLength={80} />}</Field>
          <LocationFields value={form} onChange={(v) => setForm({ ...form, ...v })} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Add or edit a one-off class, such as a makeup lecture. */
export function MakeupDialog({
  open,
  onOpenChange,
  extra,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  extra?: ExtraClass | null;
}) {
  const today = zonedNow(new Date()).date;
  const [form, setForm] = useState(() => ({
    courseCode: extra?.courseCode ?? null,
    kind: (extra?.kind ?? "lecture") as SessionKind,
    date: extra?.date ?? today,
    start: extra?.start ?? "15:00",
    end: extra?.end ?? "16:15",
    professor: extra?.professor ?? "",
    building: extra?.building ?? "",
    floor: extra?.floor ?? "",
    room: extra?.room ?? "",
    note: extra?.note ?? "",
  }));
  const [tried, setTried] = useState(false);
  const errors = {
    course: form.courseCode ? null : "Choose the course.",
    date: isValidDate(form.date) ? null : "Choose a date.",
    time: timeError(form.start, form.end),
  };
  const save = () => {
    setTried(true);
    if (errors.course || errors.date || errors.time) return;
    useAppStore.getState().saveExtra({ id: extra?.id ?? newId("makeup"), ...form, courseCode: form.courseCode! });
    toast(extra ? "Class updated" : "Makeup class added");
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={extra ? "Edit one-off class" : "Add a makeup class"}
        description="A class that happens once, outside the weekly timetable."
        footer={
          <>
            {extra && (
              <Button
                variant="danger"
                className="mr-auto"
                onClick={() => {
                  useAppStore.getState().deleteExtra(extra.id);
                  onOpenChange(false);
                }}
              >
                <Trash2 /> Remove
              </Button>
            )}
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={save}>{extra ? "Save" : "Add class"}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Course" error={tried ? errors.course : null}>
            {(id) => <CourseSelect id={id} value={form.courseCode} onChange={(courseCode) => setForm({ ...form, courseCode })} />}
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Date" error={tried ? errors.date : null}>
              {(id) => <Input id={id} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />}
            </Field>
            <Field label="Starts" error={tried ? errors.time : null}>
              {(id) => <Input id={id} type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />}
            </Field>
            <Field label="Ends">{(id) => <Input id={id} type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />}</Field>
          </div>
          <LocationFields value={form} onChange={(v) => setForm({ ...form, ...v })} />
          <Field label="Note (optional)">{(id) => <Input id={id} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={200} />}</Field>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function suggestedTerm(): Term {
  const now = new Date();
  const today = zonedNow(now).date;
  const month = now.getMonth() + 1;
  const season = month >= 8 ? "Fall" : month <= 5 ? "Spring" : "Summer";
  const start = startOfWeek(today);
  return { name: `${season} ${now.getFullYear()}`, start, end: addDays(start, 7 * 15 + 4), holidays: [] };
}

/** The semester's dates and holidays. Classes only appear between the start and end. */
export function TermDialog({ open, onOpenChange, term }: { open: boolean; onOpenChange: (open: boolean) => void; term: Term | null }) {
  const [form, setForm] = useState<Term>(() => term ?? suggestedTerm());
  const [holiday, setHoliday] = useState({ name: "", start: "", end: "" });
  const [tried, setTried] = useState(false);
  const error = !form.name.trim()
    ? "Give the semester a name."
    : !isValidDate(form.start) || !isValidDate(form.end)
      ? "Choose the start and end dates."
      : form.end < form.start
        ? "The semester must end after it starts."
        : null;
  const save = () => {
    setTried(true);
    if (error) return;
    useAppStore.getState().setTerm({ ...form, name: form.name.trim() });
    toast("Semester saved");
    onOpenChange(false);
  };
  const addHoliday = () => {
    if (!holiday.name.trim() || !isValidDate(holiday.start)) return;
    const end = isValidDate(holiday.end) && holiday.end >= holiday.start ? holiday.end : holiday.start;
    setForm({ ...form, holidays: [...form.holidays, { id: newId("holiday"), name: holiday.name.trim(), start: holiday.start, end }] });
    setHoliday({ name: "", start: "", end: "" });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Semester dates"
        description="Use the dates from your university's academic calendar. Weekly classes only appear between them."
        footer={
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={save}>Save</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Name" error={tried ? error : null}>
            {(id) => <Input id={id} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={40} />}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="First day of classes">{(id) => <Input id={id} type="date" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />}</Field>
            <Field label="Last day of classes">{(id) => <Input id={id} type="date" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />}</Field>
          </div>
          <div>
            <p className="text-[13px] font-medium text-fg">Holidays and breaks</p>
            <p className="text-[12px] text-muted">No classes are held on these days, and they don&apos;t count for attendance.</p>
            {form.holidays.length > 0 && (
              <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
                {form.holidays.map((h) => (
                  <li key={h.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{h.name}</span>
                    <span className="num text-xs text-muted">{h.start === h.end ? h.start : `${h.start} → ${h.end}`}</span>
                    <Button size="sm" variant="ghost" aria-label={`Remove ${h.name}`} onClick={() => setForm({ ...form, holidays: form.holidays.filter((x) => x.id !== h.id) })}>
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-2 grid grid-cols-[1fr_auto] items-end gap-2 sm:grid-cols-[1fr_140px_140px_auto]">
              <Field label="Holiday name" className="col-span-2 sm:col-span-1">{(id) => <Input id={id} value={holiday.name} onChange={(e) => setHoliday({ ...holiday, name: e.target.value })} maxLength={80} />}</Field>
              <Field label="From">{(id) => <Input id={id} type="date" value={holiday.start} onChange={(e) => setHoliday({ ...holiday, start: e.target.value })} />}</Field>
              <Field label="To (optional)">{(id) => <Input id={id} type="date" value={holiday.end} onChange={(e) => setHoliday({ ...holiday, end: e.target.value })} />}</Field>
              <Button variant="secondary" onClick={addHoliday} aria-label="Add holiday">
                <Plus /> Add
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
