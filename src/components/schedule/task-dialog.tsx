"use client";

import { Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/form";
import { newId, TASK_TYPES, TASK_TYPE_LABEL, TIMED_TYPES, type Subtask, type Task, type TaskType } from "@/lib/schedule/schema";
import { isValidDate, zonedNow } from "@/lib/schedule/time";
import { useAppStore } from "@/lib/state/store";
import { CourseSelect } from "./course-select";

function num(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Add or edit an assignment, project, exam or deadline. */
export function TaskDialog({
  open,
  onOpenChange,
  task,
  defaults,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  defaults?: Partial<Task>;
}) {
  const init = task ?? defaults ?? {};
  const [form, setForm] = useState(() => ({
    title: init.title ?? "",
    type: (init.type ?? "assignment") as TaskType,
    courseCode: init.courseCode ?? null,
    dueDate: init.dueDate ?? zonedNow(new Date()).date,
    dueTime: init.dueTime ?? "",
    durationMin: init.durationMin?.toString() ?? "",
    location: init.location ?? "",
    weight: init.weight?.toString() ?? "",
    effortHours: init.effortHours?.toString() ?? "",
    priority: init.priority ?? "auto",
    progress: init.progress ?? 0,
    notes: init.notes ?? "",
    subtasks: (init.subtasks ?? []) as Subtask[],
  }));
  const [newSub, setNewSub] = useState("");
  const [tried, setTried] = useState(false);
  const timed = TIMED_TYPES.has(form.type);
  const weight = num(form.weight);
  const errors = {
    title: form.title.trim() ? null : "Give it a name.",
    date: isValidDate(form.dueDate) ? null : "Choose a date.",
    weight: weight !== null && (weight < 0 || weight > 100) ? "Use a percentage between 0 and 100." : null,
  };

  const save = () => {
    setTried(true);
    if (errors.title || errors.date || errors.weight) return;
    const duration = num(form.durationMin);
    const effort = num(form.effortHours);
    useAppStore.getState().saveTask({
      id: task?.id ?? newId("task"),
      title: form.title.trim(),
      type: form.type,
      courseCode: form.courseCode,
      dueDate: form.dueDate,
      dueTime: form.dueTime || null,
      durationMin: timed && duration ? Math.min(600, Math.max(5, Math.round(duration))) : null,
      location: form.location.trim(),
      weight,
      effortHours: effort !== null ? Math.min(500, Math.max(0, effort)) : null,
      priority: form.priority as Task["priority"],
      done: task?.done ?? false,
      completedAt: task?.completedAt ?? null,
      progress: form.progress,
      notes: form.notes,
      subtasks: form.subtasks,
      createdAt: task?.createdAt ?? new Date().toISOString(),
      source: task?.source ?? "manual",
    });
    toast(task ? "Saved" : "Added", { description: "It's on your calendar and ranked on Home." });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={task ? "Edit task" : "Add an assignment, exam or deadline"}
        footer={
          <>
            {task && (
              <Button
                variant="danger"
                className="mr-auto"
                onClick={() => {
                  useAppStore.getState().deleteTask(task.id);
                  toast("Deleted");
                  onOpenChange(false);
                }}
              >
                <Trash2 /> Delete
              </Button>
            )}
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={save}>{task ? "Save" : "Add"}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Name" error={tried ? errors.title : null}>
            {(id) => <Input id={id} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={140} placeholder="e.g. Database Systems Assignment 2" />}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              {(id) => (
                <NativeSelect id={id} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as TaskType })}>
                  {TASK_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {TASK_TYPE_LABEL[t]}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
            <Field label="Course (optional)">
              {(id) => <CourseSelect id={id} value={form.courseCode} onChange={(courseCode) => setForm({ ...form, courseCode })} allowNone="No course" />}
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label={timed ? "Date" : "Due date"} error={tried ? errors.date : null}>
              {(id) => <Input id={id} type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />}
            </Field>
            <Field label={timed ? "Starts at" : "Due time (optional)"} hint={timed ? undefined : "Blank = end of day"}>
              {(id) => <Input id={id} type="time" value={form.dueTime} onChange={(e) => setForm({ ...form, dueTime: e.target.value })} />}
            </Field>
            {timed && (
              <Field label="Length (minutes)">
                {(id) => <Input id={id} type="number" min={5} max={600} inputMode="numeric" value={form.durationMin} onChange={(e) => setForm({ ...form, durationMin: e.target.value })} />}
              </Field>
            )}
          </div>
          {timed && (
            <Field label="Where (optional)">{(id) => <Input id={id} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} maxLength={120} />}</Field>
          )}
          <div className="grid grid-cols-3 gap-3">
            <Field label="Weight %" hint="Share of the grade" error={tried ? errors.weight : null}>
              {(id) => <Input id={id} type="number" min={0} max={100} inputMode="decimal" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />}
            </Field>
            <Field label="Work left (h)" hint="Your estimate">
              {(id) => <Input id={id} type="number" min={0} max={500} inputMode="decimal" value={form.effortHours} onChange={(e) => setForm({ ...form, effortHours: e.target.value })} />}
            </Field>
            <Field label="Priority">
              {(id) => (
                <NativeSelect id={id} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Task["priority"] })}>
                  <option value="auto">Automatic</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </NativeSelect>
              )}
            </Field>
          </div>
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-fg">Steps (optional)</p>
            {form.subtasks.length > 0 && (
              <ul className="mb-2 space-y-1">
                {form.subtasks.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={s.done}
                      aria-label={`${s.title} done`}
                      onChange={() => setForm({ ...form, subtasks: form.subtasks.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)) })}
                      className="size-4 accent-[var(--accent)]"
                    />
                    <span className={s.done ? "flex-1 text-muted line-through" : "flex-1"}>{s.title}</span>
                    <button type="button" aria-label={`Remove ${s.title}`} onClick={() => setForm({ ...form, subtasks: form.subtasks.filter((x) => x.id !== s.id) })} className="text-muted hover:text-fg">
                      <X className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <Input
                aria-label="New step"
                value={newSub}
                maxLength={120}
                placeholder="e.g. Write the introduction"
                onChange={(e) => setNewSub(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newSub.trim()) {
                    e.preventDefault();
                    setForm({ ...form, subtasks: [...form.subtasks, { id: newId("step"), title: newSub.trim(), done: false }] });
                    setNewSub("");
                  }
                }}
              />
              <Button
                variant="secondary"
                aria-label="Add step"
                disabled={!newSub.trim() || form.subtasks.length >= 30}
                onClick={() => {
                  setForm({ ...form, subtasks: [...form.subtasks, { id: newId("step"), title: newSub.trim(), done: false }] });
                  setNewSub("");
                }}
              >
                <Plus />
              </Button>
            </div>
            {form.subtasks.length === 0 && (
              <label className="mt-3 block text-[13px] text-muted">
                Progress: <span className="num text-fg">{form.progress}%</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={10}
                  value={form.progress}
                  onChange={(e) => setForm({ ...form, progress: Number(e.target.value) })}
                  className="mt-1 block w-full accent-[var(--accent)]"
                />
              </label>
            )}
          </div>
          <Field label="Notes (optional)">{(id) => <Textarea id={id} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={2000} />}</Field>
        </div>
      </DialogContent>
    </Dialog>
  );
}
