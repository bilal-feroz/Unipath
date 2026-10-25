"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { EVENT_CATEGORIES, EVENT_CATEGORY_LABEL, newId, type CalendarEvent, type EventCategory } from "@/lib/schedule/schema";
import { isValidDate, toMinutes, zonedNow } from "@/lib/schedule/time";
import { useAppStore } from "@/lib/state/store";
import { CourseSelect } from "./course-select";

/** Add or edit an event: university life, a study session, a personal plan or an admin date. */
export function EventDialog({
  open,
  onOpenChange,
  event,
  defaults,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: CalendarEvent | null;
  defaults?: Partial<CalendarEvent>;
}) {
  const init = event ?? defaults ?? {};
  const [form, setForm] = useState(() => ({
    title: init.title ?? "",
    category: (init.category ?? "personal") as EventCategory,
    date: init.date ?? zonedNow(new Date()).date,
    allDay: event ? event.start === null : defaults?.start === null,
    start: init.start ?? "18:00",
    end: init.end ?? "19:00",
    repeat: init.repeat ?? "none",
    until: init.until ?? "",
    location: init.location ?? "",
    courseCode: init.courseCode ?? null,
    notes: init.notes ?? "",
    url: init.url ?? "",
    inCalendar: init.inCalendar ?? true,
  }));
  const [tried, setTried] = useState(false);
  const error = !form.title.trim()
    ? "Give it a name."
    : !isValidDate(form.date)
      ? "Choose a date."
      : !form.allDay && (!form.start || !form.end || toMinutes(form.end) <= toMinutes(form.start))
        ? "It must end after it starts."
        : null;
  const safeUrl = /^https?:\/\//i.test(form.url.trim()) ? form.url.trim() : "";

  const save = () => {
    setTried(true);
    if (error) return;
    useAppStore.getState().saveEvent({
      id: event?.id ?? newId("event"),
      title: form.title.trim(),
      category: form.category,
      date: form.date,
      start: form.allDay ? null : form.start,
      end: form.allDay ? null : form.end,
      repeat: form.repeat as CalendarEvent["repeat"],
      until: form.repeat === "weekly" && isValidDate(form.until) ? form.until : null,
      location: form.location.trim(),
      courseCode: form.courseCode,
      notes: form.notes,
      url: safeUrl,
      inCalendar: form.inCalendar,
      source: event?.source ?? "manual",
    });
    toast(event ? "Event saved" : "Event added");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={event ? "Edit event" : "Add an event"}
        footer={
          <>
            {event && (
              <Button
                variant="danger"
                className="mr-auto"
                onClick={() => {
                  useAppStore.getState().deleteEvent(event.id);
                  toast("Event deleted");
                  onOpenChange(false);
                }}
              >
                <Trash2 /> Delete
              </Button>
            )}
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={save}>{event ? "Save" : "Add event"}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Name" error={tried ? error : null}>
            {(id) => <Input id={id} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={140} />}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              {(id) => (
                <NativeSelect id={id} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as EventCategory })}>
                  {EVENT_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {EVENT_CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
            <Field label="Date">{(id) => <Input id={id} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />}</Field>
          </div>
          <Switch checked={form.allDay} onChange={(allDay) => setForm({ ...form, allDay })} label="All day" />
          {!form.allDay && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Starts">{(id) => <Input id={id} type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />}</Field>
              <Field label="Ends">{(id) => <Input id={id} type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />}</Field>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Repeats">
              {(id) => (
                <NativeSelect id={id} value={form.repeat} onChange={(e) => setForm({ ...form, repeat: e.target.value as CalendarEvent["repeat"] })}>
                  <option value="none">Doesn&apos;t repeat</option>
                  <option value="weekly">Every week</option>
                </NativeSelect>
              )}
            </Field>
            {form.repeat === "weekly" && (
              <Field label="Until (optional)" hint="Blank = end of semester">
                {(id) => <Input id={id} type="date" value={form.until} onChange={(e) => setForm({ ...form, until: e.target.value })} />}
              </Field>
            )}
          </div>
          <Field label="Where (optional)">{(id) => <Input id={id} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} maxLength={120} />}</Field>
          <Field label="Course (optional)">
            {(id) => <CourseSelect id={id} value={form.courseCode} onChange={(courseCode) => setForm({ ...form, courseCode })} allowNone="No course" />}
          </Field>
          <Field label="Link (optional)" hint="https:// links only">
            {(id) => <Input id={id} type="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} maxLength={300} />}
          </Field>
          <Field label="Notes (optional)">{(id) => <Textarea id={id} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={1000} />}</Field>
          <Switch checked={form.inCalendar} onChange={(inCalendar) => setForm({ ...form, inCalendar })} label="Show on my calendar" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
