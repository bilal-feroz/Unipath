"use client";

import { CalendarCheck2, CalendarPlus, ExternalLink, Info, MapPin, PartyPopper, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell/app-shell";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/form";
import { Pill } from "@/components/ui/pill";
import { CAMPUS_CATEGORIES, EVENT_CATEGORY_LABEL, type CalendarEvent, type EventCategory } from "@/lib/schedule/schema";
import { formatDate, formatTimeRange, monthOf } from "@/lib/schedule/time";
import { useAppStore } from "@/lib/state/store";
import { cn } from "@/lib/utils";
import { EventDialog } from "./event-dialog";
import { useSchedule } from "./schedule-context";

const SHOWN: EventCategory[] = [...CAMPUS_CATEGORIES, "registration", "admin"];
const FILTERS: { value: string; label: string; match: (c: EventCategory) => boolean }[] = [
  { value: "all", label: "All", match: () => true },
  { value: "learn", label: "Workshops and seminars", match: (c) => c === "workshop" || c === "seminar" },
  { value: "clubs", label: "Clubs", match: (c) => c === "club" },
  { value: "compete", label: "Competitions", match: (c) => c === "competition" || c === "hackathon" },
  { value: "career", label: "Careers", match: (c) => c === "career-fair" },
  { value: "dates", label: "Academic dates", match: (c) => c === "registration" || c === "admin" || c === "announcement" },
  { value: "uni", label: "University", match: (c) => c === "university" },
];

export function EventsScreen() {
  const { schedule, zoned } = useSchedule();
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState<CalendarEvent | "new" | null>(null);
  const match = FILTERS.find((f) => f.value === filter)!.match;
  const events = schedule.events.filter((e) => SHOWN.includes(e.category) && match(e.category)).sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? "").localeCompare(b.start ?? ""));
  const upcoming = events.filter((e) => e.date >= zoned.date || (e.repeat === "weekly" && (e.until ?? schedule.term?.end ?? e.date) >= zoned.date));
  const past = events.filter((e) => !upcoming.includes(e));

  const card = (e: CalendarEvent) => {
    const { month } = monthOf(e.date);
    return (
      <li key={e.id} className={cn("glass flex gap-4 rounded-2xl border border-line p-4", e.inCalendar && "border-accent/30")}>
        <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-xl border border-line bg-bg/50 py-2">
          <span className="text-[11px] font-medium uppercase text-muted">{formatDate(e.date, { month: "short" })}</span>
          <span className="num text-xl font-semibold text-fg">{Number(e.date.slice(8))}</span>
          <span className="sr-only">{month}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-[15px] font-semibold text-fg">{e.title}</h3>
            <Pill tone="accent">{EVENT_CATEGORY_LABEL[e.category]}</Pill>
            {e.source === "sample" && <Pill>Sample</Pill>}
            {e.source === "imported" && <Pill>Imported</Pill>}
          </div>
          <p className="mt-0.5 text-[13px] text-muted">
            {formatDate(e.date, { weekday: "long", day: "numeric", month: "long" })} · {formatTimeRange(e.start, e.end)}
            {e.repeat === "weekly" && " · every week"}
          </p>
          {e.location && (
            <p className="mt-0.5 flex items-center gap-1 text-[13px] text-muted">
              <MapPin aria-hidden className="size-3.5" /> {e.location}
            </p>
          )}
          {e.notes && <p className="mt-1 text-[13px] text-muted">{e.notes}</p>}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant={e.inCalendar ? "secondary" : "primary"}
              aria-pressed={e.inCalendar}
              onClick={() => {
                useAppStore.getState().setEventInCalendar(e.id, !e.inCalendar);
                toast(e.inCalendar ? "Removed from your calendar" : "Added to your calendar");
              }}
            >
              {e.inCalendar ? <CalendarCheck2 /> : <CalendarPlus />} {e.inCalendar ? "On my calendar" : "Add to calendar"}
            </Button>
            {e.url && (
              <Button asChild size="sm" variant="ghost">
                <a href={e.url} target="_blank" rel="noreferrer noopener">
                  Details <ExternalLink />
                </a>
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setEditing(e)}>
              Edit
            </Button>
          </div>
        </div>
      </li>
    );
  };

  return (
    <div className="page-in mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <PageHeader
        title="University events"
        description="Workshops, clubs, competitions, career fairs and academic dates. Add the ones you want to your calendar."
        action={
          <Button onClick={() => setEditing("new")}>
            <Plus /> Add event
          </Button>
        }
      />
      <p className="mt-4 flex gap-2 rounded-xl border border-line bg-surface-2/40 px-3.5 py-2.5 text-[13px] text-muted">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
        Events here are added by you{schedule.events.some((e) => e.source === "sample") ? " or are sample data" : ""}. UniPath isn&apos;t connected to an official university feed, so nothing here is an official announcement.
      </p>
      <div role="group" aria-label="Show" className="mt-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={cn("h-8 rounded-lg border px-3 text-[13px]", filter === f.value ? "border-accent bg-accent font-semibold text-accent-fg" : "border-line text-muted hover:text-fg")}
          >
            {f.label}
          </button>
        ))}
      </div>
      {upcoming.length === 0 ? (
        <EmptyState className="mt-4" icon={<PartyPopper />} title="No upcoming events" action={<Button onClick={() => setEditing("new")}><Plus /> Add an event</Button>}>
          Add workshops, club meetings or competitions you hear about, and put the ones you&apos;ll go to on your calendar.
        </EmptyState>
      ) : (
        <ul className="mt-4 space-y-2.5">{upcoming.map(card)}</ul>
      )}
      {past.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm font-medium text-muted">Past events ({past.length})</summary>
          <ul className="mt-3 space-y-2.5 opacity-75">{past.map(card)}</ul>
        </details>
      )}
      {editing && (
        <EventDialog
          open
          onOpenChange={(v) => !v && setEditing(null)}
          event={editing === "new" ? null : editing}
          defaults={editing === "new" ? { category: "workshop", inCalendar: false, date: zoned.date } : undefined}
        />
      )}
    </div>
  );
}
