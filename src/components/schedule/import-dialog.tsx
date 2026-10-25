"use client";

import { FileText, Info, Sparkles, TriangleAlert, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { usePlanContext } from "@/components/app-shell/plan-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, NativeSelect, Textarea } from "@/components/ui/form";
import { Segmented } from "@/components/ui/segmented";
import type { CoachStatus } from "@/lib/coach/provider";
import { extractDeadlines, FLAG_TEXT, type ExtractedItem, type ExtractedType } from "@/lib/schedule/extract";
import { newId, TASK_TYPES, TASK_TYPE_LABEL, TIMED_TYPES, type CalendarEvent, type Task, type TaskType } from "@/lib/schedule/schema";
import { isValidDate } from "@/lib/schedule/time";
import { useAppStore } from "@/lib/state/store";
import { cn } from "@/lib/utils";
import { CourseSelect } from "./course-select";
import { useSchedule } from "./schedule-context";

const MAX_AI_CHARS = 20_000;

type Row = ExtractedItem & { include: boolean };

async function pdfText(file: File): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : text;
}

export function ImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const plan = usePlanContext();
  const { zoned } = useSchedule();
  const [source, setSource] = useState<"text" | "pdf">("text");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [reader, setReader] = useState<"ai" | "rules">("rules");
  const [status, setStatus] = useState<CoachStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [usedReader, setUsedReader] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/coach")
      .then((r) => (r.ok ? (r.json() as Promise<CoachStatus>) : null))
      .then((s) => {
        if (cancelled || !s) return;
        setStatus(s);
        if (s.configured) setReader("ai");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const courses = plan.curriculum.courses.map((c) => ({ code: c.code, title: c.title }));
  const toRows = (items: ExtractedItem[]) => items.map((i) => ({ ...i, include: i.confidence === "high" && !i.flags.includes("past-date") }));

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setProblem(null);
    if (file.size > 10 * 1024 * 1024) return setProblem("That PDF is over 10 MB. Try a smaller file, or paste the text.");
    setBusy(true);
    try {
      const t = await pdfText(file);
      if (!t.trim()) setProblem("No text found in that PDF. It may be a scanned image — paste the text instead.");
      setText(t);
      setFileName(file.name);
    } catch {
      setProblem("That PDF couldn't be read. Try another file, or paste the text.");
    } finally {
      setBusy(false);
    }
  };

  const run = async () => {
    setProblem(null);
    const input = text.trim();
    if (!input) return setProblem(source === "pdf" ? "Choose a PDF first." : "Paste some text first.");
    if (reader === "rules" || !status?.configured) {
      setRows(toRows(extractDeadlines(input, { today: zoned.date, courses })));
      setUsedReader("UniPath's offline reader");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ curriculumId: plan.curriculum.id, text: input.slice(0, MAX_AI_CHARS), today: zoned.date }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.items) throw new Error(json?.message ?? "The AI reader couldn't answer.");
      setRows(toRows(json.items as ExtractedItem[]));
      setUsedReader(`${json.provider} (${json.model})`);
    } catch (e) {
      // Fall back to the offline reader rather than leaving the student stuck.
      setRows(toRows(extractDeadlines(input, { today: zoned.date, courses })));
      setUsedReader("UniPath's offline reader");
      setProblem(`${e instanceof Error ? e.message : "The AI reader failed."} The offline reader was used instead.`);
    } finally {
      setBusy(false);
    }
  };

  const update = (id: string, patch: Partial<Row>) => setRows((r) => r?.map((x) => (x.id === id ? { ...x, ...patch } : x)) ?? null);
  const chosen = rows?.filter((r) => r.include) ?? [];
  const invalid = chosen.filter((r) => !r.title.trim() || !r.date || !isValidDate(r.date));

  const save = () => {
    if (invalid.length) return;
    const now = new Date().toISOString();
    const tasks: Task[] = [];
    const events: CalendarEvent[] = [];
    for (const r of chosen) {
      if (r.type === "event") {
        events.push({
          id: newId("event"), title: r.title.trim(), category: "university", date: r.date!, start: r.time, end: null, repeat: "none",
          until: null, location: r.location, courseCode: r.courseCode, notes: r.source ? `From: "${r.source}"` : "", url: "", inCalendar: true, source: "imported",
        });
      } else {
        tasks.push({
          id: newId("task"), title: r.title.trim(), type: r.type, courseCode: r.courseCode, dueDate: r.date!, dueTime: r.time,
          durationMin: null, location: TIMED_TYPES.has(r.type) ? r.location : "", weight: null, effortHours: null, priority: "auto",
          done: false, completedAt: null, progress: 0, notes: r.source ? `From: "${r.source}"` : "", subtasks: [], createdAt: now, source: "imported",
        });
      }
    }
    useAppStore.getState().importItems({ tasks, events });
    toast(`Added ${chosen.length} item${chosen.length === 1 ? "" : "s"}`, { description: "They're on your calendar and ranked on Home." });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={rows ? "Check what was found" : "Import deadlines"}
        description={
          rows
            ? `Found ${rows.length} date${rows.length === 1 ? "" : "s"} with ${usedReader}. Nothing is saved until you choose.`
            : "Paste a course outline, assignment sheet or announcement, or choose a PDF. You'll check everything before it's saved."
        }
        className="max-w-2xl"
        footer={
          rows ? (
            <>
              <Button variant="secondary" className="mr-auto" onClick={() => setRows(null)}>
                Back
              </Button>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={save} disabled={chosen.length === 0 || invalid.length > 0}>
                Add {chosen.length} to my calendar
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={run} disabled={busy}>
                {busy ? "Reading…" : "Find dates"}
              </Button>
            </>
          )
        }
      >
        {!rows ? (
          <div className="space-y-4">
            <Segmented
              label="Source"
              value={source}
              onChange={setSource}
              options={[
                { value: "text", label: "Paste text" },
                { value: "pdf", label: "PDF file" },
              ]}
            />
            {source === "text" ? (
              <Textarea
                aria-label="Text to read"
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="min-h-48"
                placeholder={"e.g. Database Systems Assignment 2 is due on November 12 at 11:59 PM.\nMidterm exam: 19 November, 9:30 am, Building B Room 105."}
              />
            ) : (
              <div>
                <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="sr-only" aria-label="PDF file" onChange={(e) => onFile(e.target.files?.[0])} />
                <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={busy}>
                  <Upload /> {fileName ? "Choose another PDF" : "Choose a PDF"}
                </Button>
                {fileName && (
                  <p className="mt-2 flex items-center gap-2 text-sm text-muted">
                    <FileText aria-hidden className="size-4" /> {fileName} · {text.length.toLocaleString()} characters of text
                  </p>
                )}
                <p className="mt-2 text-[12.5px] text-muted">The PDF is read in your browser. Screenshots and scanned pages aren&apos;t supported yet — paste the text instead.</p>
              </div>
            )}
            <fieldset>
              <legend className="mb-1.5 text-[13px] font-medium text-fg">Reader</legend>
              <div className="space-y-2">
                <label className={cn("flex items-start gap-2 rounded-xl border border-line p-3 text-sm", !status?.configured && "opacity-60")}>
                  <input type="radio" name="reader" checked={reader === "ai"} disabled={!status?.configured} onChange={() => setReader("ai")} className="mt-0.5 accent-[var(--accent)]" />
                  <span>
                    <span className="flex items-center gap-1.5 font-medium text-fg">
                      <Sparkles aria-hidden className="size-4 text-accent" /> AI reader{status?.label ? ` (${status.label})` : ""}
                    </span>
                    <span className="block text-[12.5px] text-muted">
                      {status?.configured
                        ? `Better with messy documents. The text (up to ${MAX_AI_CHARS.toLocaleString()} characters) is sent to ${status.label} — leave out anything private. ${status.privacyNote ?? ""}`
                        : "Not switched on for this site."}
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 rounded-xl border border-line p-3 text-sm">
                  <input type="radio" name="reader" checked={reader === "rules"} onChange={() => setReader("rules")} className="mt-0.5 accent-[var(--accent)]" />
                  <span>
                    <span className="block font-medium text-fg">Offline reader</span>
                    <span className="block text-[12.5px] text-muted">Finds common date formats with simple rules. Nothing leaves this device.</span>
                  </span>
                </label>
              </div>
            </fieldset>
            {problem && (
              <p role="alert" className="flex gap-2 text-sm text-warn">
                <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" /> {problem}
              </p>
            )}
          </div>
        ) : rows.length === 0 ? (
          <div className="space-y-3">
            {problem && <p className="text-sm text-warn">{problem}</p>}
            <p className="text-sm text-muted">No dates found. Check the text has dates like &quot;12 November&quot; or &quot;2026-11-12&quot;, or add the deadline by hand.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {problem && (
              <p role="status" className="flex gap-2 rounded-xl border border-warn/30 bg-warn-soft px-3 py-2 text-[13px] text-fg">
                <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-warn" /> {problem}
              </p>
            )}
            <p className="text-[12.5px] text-muted">Items with a warning start unticked. Fix anything that&apos;s wrong, then tick what to add.</p>
            <ul className="space-y-2.5">
              {rows.map((r) => (
                <li key={r.id} className={cn("rounded-xl border p-3", r.include ? "border-accent/40 bg-accent-soft/40" : "border-line")}>
                  <div className="flex items-start gap-2">
                    <input type="checkbox" checked={r.include} onChange={(e) => update(r.id, { include: e.target.checked })} aria-label={`Add ${r.title}`} className="mt-2.5 size-4 shrink-0 accent-[var(--accent)]" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Input aria-label="Name" value={r.title} onChange={(e) => update(r.id, { title: e.target.value })} maxLength={140} />
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <NativeSelect aria-label="Type" value={r.type} onChange={(e) => update(r.id, { type: e.target.value as ExtractedType })}>
                          {TASK_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {TASK_TYPE_LABEL[t as TaskType]}
                            </option>
                          ))}
                          <option value="event">Event</option>
                        </NativeSelect>
                        <CourseSelect aria-label="Course" value={r.courseCode} onChange={(courseCode) => update(r.id, { courseCode })} allowNone="No course" />
                        <Input aria-label="Date" type="date" value={r.date ?? ""} onChange={(e) => update(r.id, { date: e.target.value || null, flags: r.flags.filter((f) => f !== "no-year" && f !== "ambiguous-date") })} />
                        <Input aria-label="Time" type="time" value={r.time ?? ""} onChange={(e) => update(r.id, { time: e.target.value || null })} />
                      </div>
                      {r.flags.length > 0 && (
                        <ul className="space-y-0.5">
                          {r.flags.map((f) => (
                            <li key={f} className="flex gap-1.5 text-[12.5px] text-warn">
                              <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" /> {FLAG_TEXT[f]}
                            </li>
                          ))}
                        </ul>
                      )}
                      {r.source ? (
                        <blockquote className="border-l-2 border-line-strong pl-2 text-[12.5px] italic text-muted">&ldquo;{r.source}&rdquo;</blockquote>
                      ) : (
                        <p className="text-[12.5px] text-warn">The reader&apos;s quote wasn&apos;t found in your text — check this one carefully.</p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            {invalid.length > 0 && (
              <p role="alert" className="text-sm text-danger">
                Every ticked item needs a name and a date.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
