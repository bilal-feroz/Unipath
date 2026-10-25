"use client";

import { Building2, Clock, Compass, ExternalLink, Footprints, MapPin, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell/app-shell";
import { usePlanContext } from "@/components/app-shell/plan-context";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SearchInput } from "@/components/ui/field";
import { EmptyState, Field, Input, Textarea } from "@/components/ui/form";
import { Pill } from "@/components/ui/pill";
import { campusFor, sameName } from "@/lib/campus/registry";
import { locationLine, type ClassOccurrence } from "@/lib/schedule/occurrences";
import { newId, SESSION_KIND_LABEL, type BuildingNote } from "@/lib/schedule/schema";
import { formatDuration, formatTimeRange, minutesUntil, toMinutes, WEEKDAY_SHORT } from "@/lib/schedule/time";
import { useAppStore } from "@/lib/state/store";
import { cn } from "@/lib/utils";
import { useSchedule } from "./schedule-context";

function initialQuery(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("q") ?? "";
}

function safeUrl(u: string): string | null {
  return /^https:\/\//i.test(u.trim()) ? u.trim() : null;
}

function BuildingDialog({ note, name, onOpenChange }: { note: BuildingNote | null; name: string; onOpenChange: (v: boolean) => void }) {
  const [form, setForm] = useState({ name: note?.name ?? name, notes: note?.notes ?? "", mapUrl: note?.mapUrl ?? "" });
  const urlError = form.mapUrl && !safeUrl(form.mapUrl) ? "Use a link that starts with https://" : null;
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent
        title={note ? "Edit building notes" : `Notes for ${name || "a building"}`}
        description="Your own notes and a map link (for example from Google Maps). UniPath doesn't have an official campus map yet."
        footer={
          <>
            {note && (
              <Button variant="danger" className="mr-auto" onClick={() => { useAppStore.getState().deleteBuilding(note.id); onOpenChange(false); }}>
                Remove
              </Button>
            )}
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              disabled={!form.name.trim() || !!urlError}
              onClick={() => {
                useAppStore.getState().saveBuilding({ id: note?.id ?? newId("bldg"), name: form.name.trim(), notes: form.notes.trim(), mapUrl: safeUrl(form.mapUrl) ?? "" });
                toast("Saved");
                onOpenChange(false);
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Building name" hint="Use the same name as in your timetable.">
            {(id) => <Input id={id} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={80} />}
          </Field>
          <Field label="How to find it (optional)">
            {(id) => <Textarea id={id} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={300} placeholder="e.g. Next to the library; take the east stairs to floor 2." />}
          </Field>
          <Field label="Map link (optional)" error={urlError}>
            {(id) => <Input id={id} type="url" value={form.mapUrl} onChange={(e) => setForm({ ...form, mapUrl: e.target.value })} maxLength={500} placeholder="https://maps.app.goo.gl/…" />}
          </Field>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface RoomUse {
  room: string;
  floor: string;
  classes: { course: string; kind: string; when: string }[];
}

export function CampusScreen() {
  const plan = usePlanContext();
  const { schedule, today, zoned, nextClass, title, alerts, life } = useSchedule();
  const [query, setQuery] = useState(initialQuery);
  const [editing, setEditing] = useState<{ note: BuildingNote | null; name: string } | null>(null);
  const campus = campusFor(plan.curriculum.universityId);
  const noteFor = (name: string) => schedule.buildings.find((b) => sameName(b.name, name)) ?? null;

  // The directory: every building and room in the student's timetable, plus buildings with notes.
  const directory = new Map<string, Map<string, RoomUse>>();
  const add = (building: string, floor: string, room: string, course: string, kind: string, when: string) => {
    const b = building.trim() || "Building not set";
    if (!directory.has(b)) directory.set(b, new Map());
    const rooms = directory.get(b)!;
    const key = room.trim() || "—";
    const use = rooms.get(key) ?? { room: key, floor, classes: [] };
    use.classes.push({ course, kind, when });
    rooms.set(key, use);
  };
  for (const s of schedule.sessions) add(s.building, s.floor, s.room, title(s.courseCode), SESSION_KIND_LABEL[s.kind], `${s.days.map((d) => WEEKDAY_SHORT[d - 1]).join(", ")} ${formatTimeRange(s.start, s.end)}`);
  for (const x of schedule.extras) add(x.building, x.floor, x.room, title(x.courseCode), "One-off", formatTimeRange(x.start, x.end));
  for (const b of schedule.buildings) if (![...directory.keys()].some((k) => sameName(k, b.name))) directory.set(b.name, new Map());

  const q = query.trim().toLowerCase();
  const buildings = [...directory.entries()]
    .map(([name, rooms]) => ({
      name,
      rooms: [...rooms.values()].filter(
        (r) => !q || name.toLowerCase().includes(q) || `${name} ${r.room}`.toLowerCase().includes(q) || r.room.toLowerCase().includes(q) || r.classes.some((c) => c.course.toLowerCase().includes(q)),
      ),
      matches: !q || name.toLowerCase().includes(q) || q.includes(name.toLowerCase()),
    }))
    .filter((b) => b.matches || b.rooms.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  const todays = today.filter((o) => o.status === "scheduled");
  const travel = alerts.filter((a) => a.rule === "travel");
  const focus: ClassOccurrence | null = nextClass?.occurrence ?? null;
  const focusNote = focus ? noteFor(focus.building) : null;
  const focusMins = focus ? minutesUntil(zoned, focus.date, focus.start) : 0;

  return (
    <div className="page-in mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <PageHeader title="CampusFlow" description="Where your next class is, and every room in your timetable." />

      {schedule.sessions.length === 0 ? (
        <EmptyState className="mt-6" icon={<Compass />} title="Add your timetable to use CampusFlow" action={<Button asChild><Link href="/timetable">Go to Timetable</Link></Button>}>
          Add the building and room for each class, and CampusFlow shows where to go next.
        </EmptyState>
      ) : (
        <div className="mt-6 space-y-4">
          {focus && (
            <section aria-labelledby="next-title" className="rounded-2xl border border-accent/35 bg-accent-soft p-5">
              <p className="text-[12.5px] font-medium text-accent">
                {toMinutes(focus.start) <= zoned.minutes && focus.date === zoned.date ? "Happening now" : focus.date === zoned.date ? `Your next class · starts in ${formatDuration(focusMins)}` : "Your next class"}
              </p>
              <h2 id="next-title" className="mt-1 text-2xl font-semibold tracking-tight text-fg">
                {title(focus.courseCode)}
              </h2>
              <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-[15px] text-fg">
                <span className="inline-flex items-center gap-1.5">
                  <Clock aria-hidden className="size-4 text-muted" /> {formatTimeRange(focus.start, focus.end)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin aria-hidden className="size-4 text-muted" /> {locationLine(focus) || "Location not set"}
                </span>
              </p>
              {focusNote?.notes && <p className="mt-2 text-sm text-muted">{focusNote.notes}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {focusNote?.mapUrl ? (
                  <Button asChild>
                    <a href={focusNote.mapUrl} target="_blank" rel="noreferrer noopener">
                      Open map <ExternalLink />
                    </a>
                  </Button>
                ) : (
                  focus.building && (
                    <Button variant="secondary" onClick={() => setEditing({ note: null, name: focus.building })}>
                      <Plus /> Add a map link for {focus.building}
                    </Button>
                  )
                )}
                <Button variant="ghost" onClick={() => setQuery(focus.building)}>
                  Show in directory
                </Button>
              </div>
            </section>
          )}

          <Card aria-labelledby="day-title">
            <CardHeader titleId="day-title" title="Today, in order" />
            <CardBody>
              {todays.length === 0 ? (
                <p className="text-sm text-muted">No classes today.</p>
              ) : (
                <ol className="relative space-y-2">
                  {todays.map((o, i) => {
                    const done = toMinutes(o.end) <= zoned.minutes;
                    const now = !done && toMinutes(o.start) <= zoned.minutes;
                    const prev = todays[i - 1];
                    const gap = prev ? toMinutes(o.start) - toMinutes(prev.end) : null;
                    const moving = prev && prev.building && o.building && !sameName(prev.building, o.building);
                    return (
                      <li key={o.id}>
                        {moving && gap !== null && gap >= 0 && (
                          <p className={cn("mb-2 ml-3 flex items-center gap-1.5 text-[12.5px]", gap < life.travelBufferMin ? "font-medium text-warn" : "text-muted")}>
                            <Footprints aria-hidden className="size-3.5" /> {gap} min to get from {prev.building} to {o.building}
                          </p>
                        )}
                        <div className={cn("flex items-start gap-3 rounded-xl border px-3 py-2.5", now ? "border-accent/50 bg-accent-soft" : "border-line bg-bg/40", done && "opacity-60")}>
                          <span className="num w-[92px] shrink-0 pt-0.5 text-[12.5px] text-muted">{formatTimeRange(o.start, o.end)}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-fg">{title(o.courseCode)}</span>
                            <span className="block text-[12.5px] text-muted">
                              {locationLine(o) || "Location not set"}
                              {o.professor && ` · ${o.professor}`}
                            </span>
                          </span>
                          <Pill tone={done ? "neutral" : now ? "done" : "open"}>{done ? "Done" : now ? "Now" : `In ${formatDuration(toMinutes(o.start) - zoned.minutes)}`}</Pill>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
              {travel.length > 0 && (
                <p className="mt-3 text-[12.5px] text-muted">
                  Tight changes are based on the {life.travelBufferMin}-minute time you set in{" "}
                  <Link href="/settings" className="text-accent">
                    Settings
                  </Link>
                  . UniPath doesn&apos;t estimate walking times.
                </p>
              )}
            </CardBody>
          </Card>

          <Card aria-labelledby="dir-title">
            <CardHeader
              titleId="dir-title"
              title="Room directory"
              description={campus?.verified ? "From the official campus map and your timetable." : "From your timetable. UniPath doesn't have an official map of this campus yet."}
              action={
                <Button size="sm" variant="secondary" onClick={() => setEditing({ note: null, name: "" })}>
                  <Plus /> Building notes
                </Button>
              }
            />
            <CardBody className="space-y-3">
              <SearchInput label="Search rooms, buildings or courses" placeholder="Search rooms, buildings or courses…" value={query} onChange={(e) => setQuery(e.target.value)} />
              {buildings.length === 0 ? (
                <p className="text-sm text-muted">Nothing matches &ldquo;{query}&rdquo;.</p>
              ) : (
                <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {buildings.map((b) => {
                    const note = noteFor(b.name);
                    return (
                      <li key={b.name} className="rounded-xl border border-line bg-bg/40 p-3.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className="flex items-center gap-2 text-[15px] font-semibold text-fg">
                            <Building2 aria-hidden className="size-4 text-accent" /> {b.name}
                          </p>
                          <div className="flex gap-1">
                            {note?.mapUrl && (
                              <Button asChild size="sm" variant="ghost">
                                <a href={note.mapUrl} target="_blank" rel="noreferrer noopener" aria-label={`Map for ${b.name}`}>
                                  <ExternalLink />
                                </a>
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" aria-label={`Notes for ${b.name}`} onClick={() => setEditing({ note, name: b.name })}>
                              <Pencil />
                            </Button>
                          </div>
                        </div>
                        {note?.notes && <p className="mt-1 text-[13px] text-muted">{note.notes}</p>}
                        <ul className="mt-2 space-y-1.5">
                          {b.rooms.map((r) => (
                            <li key={r.room} className="text-[13px]">
                              <span className="font-medium text-fg">Room {r.room}</span>
                              {r.floor && <span className="text-muted"> · Floor {r.floor}</span>}
                              <ul className="text-muted">
                                {r.classes.map((c, i) => (
                                  <li key={i} className="truncate">
                                    {c.course} ({c.kind}) · {c.when}
                                  </li>
                                ))}
                              </ul>
                            </li>
                          ))}
                        </ul>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      )}
      {editing && <BuildingDialog note={editing.note} name={editing.name} onOpenChange={(v) => !v && setEditing(null)} />}
    </div>
  );
}
