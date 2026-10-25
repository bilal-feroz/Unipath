"use client";

import { CheckCircle2, TriangleAlert } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Pill } from "@/components/ui/pill";
import type { AgendaItem } from "@/lib/schedule/agenda";
import { EVENT_CATEGORY_LABEL, SESSION_KIND_LABEL, TASK_TYPE_LABEL, type EventCategory, type SessionKind, type TaskType } from "@/lib/schedule/schema";
import { formatTime, formatTimeRange } from "@/lib/schedule/time";
import { cn } from "@/lib/utils";
import { EventDialog } from "./event-dialog";
import { GROUP_META, itemGroup } from "./item-style";
import { MeetingDialog } from "./meeting-dialog";
import { useSchedule } from "./schedule-context";
import { TaskDialog } from "./task-dialog";

export function itemTypeLabel(item: AgendaItem): string {
  if (item.kind === "class") return SESSION_KIND_LABEL[item.category as SessionKind];
  if (item.kind === "task") return TASK_TYPE_LABEL[item.category as TaskType];
  return EVENT_CATEGORY_LABEL[item.category as EventCategory];
}

export function itemTime(item: AgendaItem): string {
  if (item.kind === "task") return item.start ? (item.end ? formatTimeRange(item.start, item.end) : `Due ${formatTime(item.start)}`) : "Due today";
  return formatTimeRange(item.start, item.end);
}

/** Opens the right editor for a calendar entry. Render `dialogs` once in the page. */
export function useItemOpener() {
  const { schedule } = useSchedule();
  const [open, setOpen] = useState<AgendaItem | null>(null);
  const close = (v: boolean) => !v && setOpen(null);
  let dialogs: ReactNode = null;
  if (open?.kind === "class" && open.occurrence) {
    dialogs = <MeetingDialog key={open.id} occurrence={open.occurrence} onOpenChange={close} />;
  } else if (open?.kind === "task") {
    const task = schedule.tasks.find((t) => t.id === open.ref.id) ?? null;
    if (task) dialogs = <TaskDialog key={open.id} open task={task} onOpenChange={close} />;
  } else if (open?.kind === "event") {
    const event = schedule.events.find((e) => e.id === open.ref.id) ?? null;
    if (event) dialogs = <EventDialog key={open.id} open event={event} onOpenChange={close} />;
  }
  return { openItem: setOpen, dialogs };
}

/** One calendar entry: time, colour by type, title, details and any warning. */
export function AgendaRow({ item, onOpen, showTime = true, dense }: { item: AgendaItem; onOpen: (item: AgendaItem) => void; showTime?: boolean; dense?: boolean }) {
  const { flagged, title } = useSchedule();
  const group = GROUP_META[itemGroup(item)];
  const warn = flagged.has(item.ref.id) || (item.occurrence?.sessionId ? flagged.has(item.occurrence.sessionId) : false);
  const sample = item.task?.source === "sample" || item.event?.source === "sample";
  const sub = [
    item.kind !== "class" && item.courseCode ? title(item.courseCode) : null,
    item.location || null,
    item.note && item.kind === "class" ? item.note : null,
  ].filter(Boolean);
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border border-l-[3px] border-line bg-bg/40 text-left transition-colors hover:border-line-strong hover:bg-surface-2/60",
        group.border,
        dense ? "px-2.5 py-1.5" : "px-3 py-2.5",
        item.inactive && "opacity-60",
        warn && "ring-1 ring-warn/60",
      )}
    >
      {showTime && <span className={cn("num shrink-0 pt-0.5 text-muted", dense ? "w-[64px] text-[11.5px]" : "w-[92px] text-[12.5px]")}>{itemTime(item)}</span>}
      <span className="min-w-0 flex-1">
        <span className={cn("flex items-center gap-1.5 font-medium text-fg", dense ? "text-[12.5px]" : "text-sm", item.inactive && "line-through")}>
          {item.kind === "task" && item.task?.done && <CheckCircle2 aria-label="Done" className="size-3.5 shrink-0 text-done" />}
          <span className="truncate">{item.title}</span>
        </span>
        {!dense && (
          <span className="mt-0.5 block truncate text-[12.5px] text-muted">
            {itemTypeLabel(item)}
            {sub.length > 0 && ` · ${sub.join(" · ")}`}
          </span>
        )}
      </span>
      {warn && <TriangleAlert aria-label="Has a conflict" className="mt-0.5 size-4 shrink-0 text-warn" />}
      {sample && !dense && <Pill className="shrink-0">Sample</Pill>}
    </button>
  );
}
