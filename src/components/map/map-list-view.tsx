"use client";

import { useMemo } from "react";
import { usePlanContext } from "@/components/app-shell/plan-context";
import { StatusBadge } from "@/components/courses/status-badge";
import { referencedCourses } from "@/lib/curriculum/prereq";
import { courseName } from "@/lib/engine";
import { joinNames } from "@/lib/utils";

/**
 * The degree map as a list, for small screens and screen readers.
 * Courses are grouped by "step": step 1 has no prerequisites, step 2 needs a step-1 course, and so on.
 */
export function MapListView({ onOpenCourse }: { onOpenCourse: (code: string) => void }) {
  const plan = usePlanContext();
  const levels = useMemo(() => {
    const memo = new Map<string, number>();
    const depth = (code: string, seen = new Set<string>()): number => {
      if (memo.has(code)) return memo.get(code)!;
      if (seen.has(code)) return 1;
      seen.add(code);
      const refs = referencedCourses(plan.index.byCode.get(code)?.prerequisite ?? null).filter((r) => plan.index.byCode.has(r));
      const d = refs.length ? 1 + Math.max(...refs.map((r) => depth(r, seen))) : 1;
      memo.set(code, d);
      return d;
    };
    const byLevel = new Map<number, string[]>();
    for (const c of plan.curriculum.courses) {
      const d = depth(c.code);
      byLevel.set(d, [...(byLevel.get(d) ?? []), c.code]);
    }
    return [...byLevel.entries()].sort(([a], [b]) => a - b);
  }, [plan]);

  return (
    <div className="space-y-5">
      {levels.map(([level, codes]) => (
        <section key={level} aria-labelledby={`level-${level}`} className="rounded-2xl border border-line bg-surface">
          <header className="border-b border-line px-4 py-3">
            <h2 id={`level-${level}`} className="font-semibold">
              Step {level}
            </h2>
            <p className="text-[13px] text-muted">
              {level === 1 ? "No prerequisites — these can be taken first." : `Each needs at least one course from step ${level - 1}.`}
            </p>
          </header>
          <ul className="divide-y divide-line">
            {codes.map((code) => {
              const course = plan.index.byCode.get(code)!;
              const needs = referencedCourses(course.prerequisite).filter((r) => plan.index.byCode.has(r));
              const leadsTo = plan.index.dependents.get(code) ?? [];
              return (
                <li key={code}>
                  <button
                    type="button"
                    onClick={() => onOpenCourse(code)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-2/40"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-fg">{course.title}</span>
                      <span className="num block text-[11px] text-dim">{course.code}</span>
                      {needs.length > 0 && (
                        <span className="mt-1 block text-[12.5px] text-muted">
                          Needs: {joinNames(needs.map((c) => courseName(plan.index, c)))}
                        </span>
                      )}
                      {leadsTo.length > 0 && (
                        <span className="block text-[12.5px] text-muted">
                          Leads to: {joinNames(leadsTo.map((c) => courseName(plan.index, c)))}
                        </span>
                      )}
                    </span>
                    <StatusBadge status={plan.states.get(code)!.status} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
