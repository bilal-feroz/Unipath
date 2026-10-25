"use client";

import { ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell/app-shell";
import { usePlanContext } from "@/components/app-shell/plan-context";
import { Button } from "@/components/ui/button";
import { SearchInput, Select } from "@/components/ui/field";
import { ProgressBar } from "@/components/ui/progress-bar";
import type { CourseStatus } from "@/lib/engine";
import { cn, plural } from "@/lib/utils";
import { CourseDetailDialog } from "./course-detail-dialog";
import { lockedReason } from "./locked-reason";
import { STATUS_META, STATUS_ORDER, StatusBadge } from "./status-badge";
import { useCourseActions } from "./use-course-actions";

type StatusFilter = "all" | CourseStatus;

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  ...STATUS_ORDER.map((s) => ({ value: s, label: STATUS_META[s].label })),
];

function initialFilter(): StatusFilter {
  if (typeof window === "undefined") return "all";
  const hash = window.location.hash.replace("#", "");
  return (FILTERS.some((f) => f.value === hash) ? hash : "all") as StatusFilter;
}

export function CoursesScreen() {
  const plan = usePlanContext();
  const { toggle } = useCourseActions();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>(initialFilter);
  const [groupId, setGroupId] = useState("all");
  const [openCode, setOpenCode] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: 0, completed: 0, planned: 0, eligible: 0, locked: 0 };
    for (const s of plan.states.values()) {
      c.all++;
      c[s.status]++;
    }
    return c;
  }, [plan.states]);

  const q = query.trim().toLowerCase();
  const groups = plan.curriculum.groups
    .filter((g) => groupId === "all" || g.id === groupId)
    .map((g) => {
      const courses = g.courses
        .map((code) => plan.index.byCode.get(code)!)
        .filter((c) => {
          const s = plan.states.get(c.code)!;
          if (status !== "all" && s.status !== status) return false;
          return !q || c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q);
        });
      return { group: g, progress: plan.progress.groups.find((p) => p.group.id === g.id)!, courses };
    })
    .filter((g) => g.courses.length > 0);

  const total = groups.reduce((sum, g) => sum + g.courses.length, 0);
  const clearFilters = () => {
    setQuery("");
    setStatus("all");
    setGroupId("all");
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow="02 · My Courses"
        title="Your courses"
        description="Tick the courses you've finished. Your progress, plan and graduation estimate update instantly."
      />

      <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center">
        <SearchInput
          className="md:max-w-xs md:flex-1"
          label="Search courses"
          placeholder="Search by name or code…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Select label="Requirement" value={groupId} onChange={(e) => setGroupId(e.target.value)} className="md:w-60">
          <option value="all">All requirements</option>
          {plan.curriculum.groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.title}
            </option>
          ))}
        </Select>
      </div>
      <div role="group" aria-label="Filter by status" className="mt-3 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={status === f.value}
            onClick={() => setStatus(f.value)}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-[13px] transition-colors",
              status === f.value
                ? "border-accent bg-accent-soft font-semibold text-fg"
                : "border-line bg-surface text-muted hover:border-line-strong hover:text-fg",
            )}
          >
            {f.label}
            <span className="num text-xs text-muted">{counts[f.value]}</span>
          </button>
        ))}
      </div>

      <p className="sr-only" aria-live="polite">
        Showing {plural(total, "course")}
      </p>

      {total === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-line-strong px-6 py-12 text-center">
          <p className="font-medium text-fg">No courses match these filters.</p>
          <p className="mt-1 text-sm text-muted">
            {status === "completed" && plan.completed.size === 0
              ? "No completed courses yet. Tick the courses you've already finished to see your personalized plan."
              : "Try a different search or filter."}
          </p>
          <Button variant="secondary" className="mt-4" onClick={clearFilters}>
            Show all courses
          </Button>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {groups.map(({ group, progress, courses }) => (
            <section key={group.id} aria-labelledby={`g-${group.id}`} className="rounded-2xl border border-line bg-surface">
              <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line px-4 py-3.5 sm:px-5">
                <div className="min-w-0 flex-1">
                  <h2 id={`g-${group.id}`} className="font-semibold text-fg">
                    {group.title}
                  </h2>
                  <p className="text-[13px] text-muted">{group.description}</p>
                </div>
                <div className="flex w-full items-center gap-3 sm:w-56">
                  <ProgressBar
                    size="sm"
                    tone={progress.done ? "done" : "accent"}
                    value={progress.countedCredits}
                    max={progress.requiredCredits}
                    label={`${group.title}: ${progress.countedCredits} of ${progress.requiredCredits} credit hours`}
                  />
                  <span className={cn("num shrink-0 text-xs", progress.done ? "text-done" : "text-muted")}>
                    {progress.countedCredits}/{progress.requiredCredits}
                  </span>
                </div>
              </header>
              <ul className="divide-y divide-line">
                {courses.map((course) => {
                  const state = plan.states.get(course.code)!;
                  const done = state.status === "completed";
                  const reason =
                    state.status === "locked"
                      ? lockedReason(plan.index, state, plan.progress.earnedCredits)
                      : state.notNeeded
                        ? "Optional — this requirement is already complete"
                        : "";
                  return (
                    <li key={course.code} className="flex items-center gap-1 pl-3 pr-2 sm:pl-4" data-testid={`course-${course.code}`}>
                      <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center">
                        <input
                          type="checkbox"
                          checked={done}
                          onChange={() => toggle(course.code)}
                          aria-label={`${course.title}: mark as ${done ? "not completed" : "completed"}`}
                          className="size-[18px] accent-[var(--done)]"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setOpenCode(course.code)}
                        className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-lg py-2 pr-1 text-left hover:bg-surface-2/40"
                      >
                        <span className="num hidden w-[72px] shrink-0 text-xs text-dim sm:block">{course.code}</span>
                        <span className="min-w-0 flex-1">
                          <span className={cn("block text-sm font-medium", done ? "text-muted" : "text-fg")}>
                            {course.title}
                          </span>
                          <span className="num block text-[11px] text-dim sm:hidden">{course.code}</span>
                          {reason && <span className="mt-0.5 block text-[12.5px] text-muted">{reason}</span>}
                        </span>
                        <span className="num hidden shrink-0 text-xs text-muted sm:block">{course.credits} cr</span>
                        <StatusBadge status={state.status} className="max-sm:hidden" />
                        <StatusBadge status={state.status} compact className="sm:hidden" />
                        <ChevronRight aria-hidden className="size-4 shrink-0 text-dim" />
                        <span className="sr-only">, open details</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <CourseDetailDialog code={openCode} onChange={setOpenCode} />
    </div>
  );
}
