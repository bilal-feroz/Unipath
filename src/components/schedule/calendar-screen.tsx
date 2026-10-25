"use client";

import { CalendarPlus, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell/app-shell";
import { usePlanContext } from "@/components/app-shell/plan-context";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SearchInput, Select } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { agendaItems, type AgendaItem } from "@/lib/schedule/agenda";
import {
  addDays,
  formatDate,
  isValidDate,
  monthGrid,
  monthOf,
  startOfWeek,
  WEEKDAY_SHORT,
  type DateStr,
} from "@/lib/schedule/time";
import { cn } from "@/lib/utils";
import { AgendaRow, useItemOpener } from "./agenda-row";
import { MakeupDialog } from "./class-dialogs";
import { EventDialog } from "./event-dialog";
import { GROUP_META, itemGroup, type ItemGroup } from "./item-style";
import { useSchedule } from "./schedule-context";
import { TaskDialog } from "./task-dialog";

type View = "month" | "week" | "day";
const GROUPS = Object.keys(GROUP_META) as ItemGroup[];

function initialDate(today: DateStr): DateStr {
  if (typeof window === "undefined") return today;
  const d = new URLSearchParams(window.location.search).get("date");
  return d && isValidDate(d) ? d : today;
}

function DayPanel({ date, items, onOpen, onAdd }: { date: DateStr; items: AgendaItem[]; onOpen: (i: AgendaItem) => void; onAdd: (kind: "task" | "event") => void }) {
  return (
    <section aria-labelledby="day-title" className="glass rounded-2xl border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="day-title" className="text-[15px] font-semibold">
          {formatDate(date, { weekday: "long", day: "numeric", month: "long" })}
        </h2>
        <div className="flex gap-1.5">
          <Button size="sm" variant="secondary" onClick={() => onAdd("task")}>
            <Plus /> Deadline
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onAdd("event")}>
            <Plus /> Event
          </Button>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Nothing scheduled.</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {items.map((i) => (
            <li key={i.id}>
              <AgendaRow item={i} onOpen={onOpen} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function CalendarScreen() {
  const plan = usePlanContext();
  const { schedule, title, zoned, flagged } = useSchedule();
  const today = zoned.date;
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState<DateStr>(() => initialDate(today));
  const [selected, setSelected] = useState<DateStr>(() => initialDate(today));
  const [groups, setGroups] = useState<Set<ItemGroup>>(new Set(GROUPS));
  const [course, setCourse] = useState("");
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState<{ kind: "task" | "event" | "makeup"; date: DateStr } | null>(null);
  const { openItem, dialogs } = useItemOpener();

  const { year, month } = monthOf(cursor);
  const range = useMemo(() => {
    if (view === "month") {
      const grid = monthGrid(year, month);
      return { from: grid[0], to: grid[41], days: grid };
    }
    if (view === "week") {
      const from = startOfWeek(cursor);
      const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
      return { from, to: days[6], days };
    }
    return { from: cursor, to: cursor, days: [cursor] };
  }, [view, cursor, year, month]);

  const q = query.trim().toLowerCase();
  const items = useMemo(
    () =>
      agendaItems(schedule, range.from, range.to, title).filter(
        (i) =>
          groups.has(itemGroup(i)) &&
          (!course || i.courseCode === course) &&
          (!q || i.title.toLowerCase().includes(q) || i.location.toLowerCase().includes(q)),
      ),
    [schedule, range, title, groups, course, q],
  );
  const byDate = useMemo(() => {
    const m = new Map<DateStr, AgendaItem[]>();
    for (const i of items) m.set(i.date, [...(m.get(i.date) ?? []), i]);
    return m;
  }, [items]);

  const step = (dir: 1 | -1) => {
    if (view === "month") {
      const m = month + dir;
      const y = year + (m < 1 ? -1 : m > 12 ? 1 : 0);
      setCursor(`${y}-${String(((m + 11) % 12) + 1).padStart(2, "0")}-01`);
    } else setCursor(addDays(cursor, dir * (view === "week" ? 7 : 1)));
  };
  const label =
    view === "month"
      ? formatDate(`${year}-${String(month).padStart(2, "0")}-01`, { month: "long", year: "numeric" })
      : view === "week"
        ? `${formatDate(range.from, { day: "numeric", month: "short" })} – ${formatDate(range.to, { day: "numeric", month: "short", year: "numeric" })}`
        : formatDate(cursor, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const courses = [...new Set([...plan.inProgress, ...schedule.sessions.map((s) => s.courseCode)])];

  return (
    <div className="page-in mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Calendar"
        description="Classes, deadlines, exams and events in one place."
        action={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <CalendarPlus /> Add
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => setAdding({ kind: "task", date: selected })}>Assignment, exam or deadline</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setAdding({ kind: "event", date: selected })}>Event</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setAdding({ kind: "makeup", date: selected })}>One-off class</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => { setCursor(today); setSelected(today); }}>
          Today
        </Button>
        <Button variant="ghost" size="sm" aria-label="Previous" onClick={() => step(-1)}>
          <ChevronLeft />
        </Button>
        <Button variant="ghost" size="sm" aria-label="Next" onClick={() => step(1)}>
          <ChevronRight />
        </Button>
        <h2 className="mr-auto text-[17px] font-semibold tracking-tight" aria-live="polite">
          {label}
        </h2>
        <Segmented
          label="Calendar view"
          value={view}
          onChange={(v) => {
            setView(v);
            setCursor(selected);
          }}
          options={[
            { value: "month", label: "Month" },
            { value: "week", label: "Week" },
            { value: "day", label: "Day" },
          ]}
        />
      </div>

      <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center">
        <div role="group" aria-label="Show" className="flex flex-wrap gap-1.5">
          {GROUPS.map((g) => {
            const on = groups.has(g);
            return (
              <button
                key={g}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  const next = new Set(groups);
                  if (on) next.delete(g);
                  else next.add(g);
                  setGroups(next);
                }}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12.5px] transition-colors",
                  on ? "border-line-strong bg-surface-2 text-fg" : "border-line text-dim line-through",
                )}
              >
                <span aria-hidden className={cn("size-2 rounded-full", GROUP_META[g].dot)} />
                {GROUP_META[g].label}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2 md:ml-auto">
          <Select label="Course" value={course} onChange={(e) => setCourse(e.target.value)} className="h-9 max-w-[200px] text-[13px]">
            <option value="">All courses</option>
            {courses.map((c) => (
              <option key={c} value={c}>
                {title(c)}
              </option>
            ))}
          </Select>
          <SearchInput label="Search the calendar" placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} className="w-40 [&_input]:h-9" />
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        {view === "month" && (
          <div className="glass overflow-hidden rounded-2xl border border-line">
            <div className="grid grid-cols-7 border-b border-line">
              {WEEKDAY_SHORT.map((d) => (
                <p key={d} className="py-2 text-center text-[12px] font-medium text-muted">
                  {d}
                </p>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {range.days.map((d) => {
                const list = byDate.get(d) ?? [];
                const inMonth = monthOf(d).month === month;
                const warn = list.some((i) => flagged.has(i.ref.id));
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSelected(d)}
                    aria-label={`${formatDate(d, { weekday: "long", day: "numeric", month: "long" })}, ${list.length} item${list.length === 1 ? "" : "s"}`}
                    aria-pressed={selected === d}
                    className={cn(
                      "min-h-[86px] border-b border-r border-line/70 p-1.5 text-left align-top transition-colors hover:bg-surface-2/50 sm:min-h-[104px]",
                      !inMonth && "bg-bg/30 text-dim",
                      selected === d && "bg-accent-soft",
                    )}
                  >
                    <span className="flex items-center justify-between">
                      <span
                        className={cn(
                          "num inline-flex size-6 items-center justify-center rounded-full text-[12px]",
                          d === today ? "bg-accent font-semibold text-accent-fg" : inMonth ? "text-fg" : "text-dim",
                        )}
                      >
                        {Number(d.slice(8))}
                      </span>
                      {warn && <span aria-hidden className="size-1.5 rounded-full bg-warn" />}
                    </span>
                    <span className="mt-1 hidden space-y-0.5 sm:block">
                      {list.slice(0, 3).map((i) => (
                        <span key={i.id} className={cn("flex items-center gap-1 truncate rounded px-1 text-[11px] leading-[18px]", GROUP_META[itemGroup(i)].chip, i.inactive && "line-through opacity-60")}>
                          {i.title}
                        </span>
                      ))}
                      {list.length > 3 && <span className="block px-1 text-[11px] text-muted">+{list.length - 3} more</span>}
                    </span>
                    {list.length > 0 && (
                      <span className="mt-1 flex flex-wrap gap-0.5 sm:hidden">
                        {list.slice(0, 4).map((i) => (
                          <span key={i.id} aria-hidden className={cn("size-1.5 rounded-full", GROUP_META[itemGroup(i)].dot)} />
                        ))}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {view === "week" && (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-7">
            {range.days.map((d) => (
              <section key={d} aria-label={formatDate(d, { weekday: "long", day: "numeric", month: "long" })} className={cn("glass min-h-28 rounded-2xl border border-line p-2", d === today && "border-accent/50")}>
                <button type="button" onClick={() => setSelected(d)} className="mb-1.5 block w-full text-left text-[12.5px] font-medium text-muted hover:text-fg">
                  {formatDate(d, { weekday: "short", day: "numeric" })}
                </button>
                <ul className="space-y-1">
                  {(byDate.get(d) ?? []).map((i) => (
                    <li key={i.id}>
                      <AgendaRow item={i} onOpen={openItem} dense />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        {view === "day" ? (
          <div className="lg:col-span-2">
            <DayPanel date={cursor} items={byDate.get(cursor) ?? []} onOpen={openItem} onAdd={(kind) => setAdding({ kind, date: cursor })} />
          </div>
        ) : (
          <DayPanel date={selected} items={agendaItems(schedule, selected, selected, title).filter((i) => groups.has(itemGroup(i)) && (!course || i.courseCode === course))} onOpen={openItem} onAdd={(kind) => setAdding({ kind, date: selected })} />
        )}
      </div>

      {dialogs}
      {adding?.kind === "task" && <TaskDialog open onOpenChange={(v) => !v && setAdding(null)} defaults={{ dueDate: adding.date }} />}
      {adding?.kind === "event" && <EventDialog open onOpenChange={(v) => !v && setAdding(null)} defaults={{ date: adding.date }} />}
      {adding?.kind === "makeup" && <MakeupDialog open onOpenChange={(v) => !v && setAdding(null)} />}
    </div>
  );
}
