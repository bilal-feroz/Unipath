"use client";

import { ChevronDown, FileUp, ListTodo, Plus } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/app-shell";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/form";
import { Pill, type PillTone } from "@/components/ui/pill";
import { ProgressBar } from "@/components/ui/progress-bar";
import { TASK_TYPE_LABEL, type Task } from "@/lib/schedule/schema";
import { inView, type RankedTask, type TaskView } from "@/lib/schedule/tasks";
import { formatDate, formatTime, relativeDay } from "@/lib/schedule/time";
import { useAppStore } from "@/lib/state/store";
import { cn } from "@/lib/utils";
import { ImportDialog } from "./import-dialog";
import { GROUP_META, taskGroup } from "./item-style";
import { useSchedule } from "./schedule-context";
import { TaskDialog } from "./task-dialog";

const VIEWS: { value: TaskView; label: string }[] = [
  { value: "all", label: "All" },
  { value: "today", label: "Due today" },
  { value: "week", label: "This week" },
  { value: "overdue", label: "Overdue" },
  { value: "completed", label: "Completed" },
];

const LEVEL_TONE: Record<string, PillTone> = { high: "warn", medium: "open", low: "neutral" };

function TaskCard({ r, onEdit }: { r: RankedTask; onEdit: (t: Task) => void }) {
  const { title, zoned, flagged } = useSchedule();
  const [open, setOpen] = useState(false);
  const t = r.task;
  const group = GROUP_META[taskGroup(t.type)];
  const due = `${t.done ? "Was due" : r.overdue ? "Was due" : "Due"} ${relativeDay(t.dueDate, zoned.date)} · ${formatDate(t.dueDate)}${t.dueTime ? ` · ${formatTime(t.dueTime)}` : ""}`;
  return (
    <li className={cn("glass rounded-2xl border border-l-[3px] border-line", group.border, flagged.has(t.id) && !t.done && "ring-1 ring-warn/60")}>
      <div className="flex items-start gap-3 p-3.5">
        <input
          type="checkbox"
          checked={t.done}
          onChange={(e) => useAppStore.getState().setTaskDone(t.id, e.target.checked)}
          aria-label={`${t.title} done`}
          className="mt-1 size-[18px] shrink-0 accent-[var(--accent)]"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <button type="button" onClick={() => onEdit(t)} className={cn("text-left text-[15px] font-medium text-fg hover:text-accent", t.done && "text-muted line-through")}>
              {t.title}
            </button>
            {!t.done && (
              <Pill tone={r.overdue ? "warn" : LEVEL_TONE[r.level]} title={r.manual ? "Set by you" : "Set by UniPath"}>
                {r.overdue ? "Overdue" : `${r.level[0].toUpperCase()}${r.level.slice(1)}${r.manual ? "" : " priority"}`}
              </Pill>
            )}
            {t.source !== "manual" && <Pill>{t.source === "sample" ? "Sample" : "Imported"}</Pill>}
          </div>
          <p className="mt-0.5 text-[13px] text-muted">
            {TASK_TYPE_LABEL[t.type]}
            {t.courseCode && ` · ${title(t.courseCode)}`}
            {t.weight !== null && ` · ${t.weight}%`}
          </p>
          <p className={cn("mt-0.5 text-[13px]", r.overdue && !t.done ? "font-medium text-warn" : "text-muted")}>{due}</p>
          {!t.done && r.why.length > 0 && <p className="mt-1 text-[12.5px] text-dim">Why: {r.why.join(" · ")}</p>}
          {!t.done && (r.progress > 0 || t.subtasks.length > 0) && (
            <div className="mt-2 flex items-center gap-2">
              <ProgressBar className="max-w-[220px]" size="sm" value={r.progress} max={100} label={`${t.title}: ${r.progress}% done`} />
              <span className="num text-[12px] text-muted">{r.progress}%</span>
            </div>
          )}
          {(t.subtasks.length > 0 || t.notes) && (
            <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="mt-1.5 inline-flex items-center gap-1 text-[12.5px] font-medium text-accent">
              <ChevronDown aria-hidden className={cn("size-3.5 transition-transform", open && "rotate-180")} />
              {open ? "Hide details" : t.subtasks.length ? `${t.subtasks.filter((s) => s.done).length}/${t.subtasks.length} steps` : "Notes"}
            </button>
          )}
          {open && (
            <div className="mt-2 space-y-2">
              {t.subtasks.length > 0 && (
                <ul className="space-y-1">
                  {t.subtasks.map((s) => (
                    <li key={s.id}>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={s.done} onChange={() => useAppStore.getState().toggleSubtask(t.id, s.id)} className="size-4 accent-[var(--accent)]" />
                        <span className={s.done ? "text-muted line-through" : "text-fg"}>{s.title}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              {t.notes && <p className="whitespace-pre-wrap text-[13px] text-muted">{t.notes}</p>}
            </div>
          )}
        </div>
        <Button size="sm" variant="ghost" onClick={() => onEdit(t)}>
          Edit
        </Button>
      </div>
    </li>
  );
}

export function TasksScreen() {
  const { ranked, zoned } = useSchedule();
  const [view, setView] = useState<TaskView>("all");
  const [editing, setEditing] = useState<Task | "new" | null>(null);
  const [importing, setImporting] = useState(false);
  const counts = Object.fromEntries(VIEWS.map((v) => [v.value, ranked.filter((r) => inView(r, v.value, zoned)).length])) as Record<TaskView, number>;
  const list = ranked.filter((r) => inView(r, view, zoned));
  if (view === "completed") list.sort((a, b) => (b.task.completedAt ?? "").localeCompare(a.task.completedAt ?? ""));

  return (
    <div className="page-in mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Assignments and exams"
        description="Most urgent first. UniPath looks at the deadline, the work left, how much it's worth and what else is due."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setImporting(true)}>
              <FileUp /> Import deadlines
            </Button>
            <Button onClick={() => setEditing("new")}>
              <Plus /> Add
            </Button>
          </div>
        }
      />

      <div role="tablist" aria-label="Show" className="mt-6 flex gap-1 overflow-x-auto rounded-[11px] border border-line bg-bg/60 p-1">
        {VIEWS.map((v) => (
          <button
            key={v.value}
            type="button"
            role="tab"
            aria-selected={view === v.value}
            onClick={() => setView(v.value)}
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13px]",
              view === v.value ? "bg-accent font-semibold text-accent-fg" : "text-muted hover:text-fg",
            )}
          >
            {v.label}
            <span className={cn("num text-[11.5px]", view === v.value ? "text-accent-fg/80" : "text-dim")}>{counts[v.value]}</span>
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState
          className="mt-4"
          icon={<ListTodo />}
          title={view === "completed" ? "Nothing completed yet" : view === "overdue" ? "Nothing overdue" : "Nothing here"}
          action={
            view !== "completed" && (
              <>
                <Button onClick={() => setEditing("new")}>
                  <Plus /> Add a deadline
                </Button>
                <Button variant="secondary" onClick={() => setImporting(true)}>
                  <FileUp /> Import from a course outline
                </Button>
              </>
            )
          }
        >
          {view === "all" ? "Add assignments, projects, quizzes and exams, or import them from a course outline." : null}
        </EmptyState>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {list.map((r) => (
            <TaskCard key={r.task.id} r={r} onEdit={setEditing} />
          ))}
        </ul>
      )}

      {editing && <TaskDialog open onOpenChange={(v) => !v && setEditing(null)} task={editing === "new" ? null : editing} />}
      {importing && <ImportDialog open onOpenChange={setImporting} />}
    </div>
  );
}
