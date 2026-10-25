"use client";

import { useMemo } from "react";
import { usePlanContext } from "@/components/app-shell/plan-context";
import { StatusBadge } from "@/components/courses/status-badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { keyCourses } from "@/lib/engine";
import { plural } from "@/lib/utils";

/** Courses that hold up the most later courses. A transparent heuristic, labelled as such. */
export function KeyCourses({ onOpenCourse }: { onOpenCourse: (code: string) => void }) {
  const plan = usePlanContext();
  const top = useMemo(
    () => keyCourses(plan.index, plan.assumedDone, plan.record.electiveChoices, 5),
    [plan.index, plan.assumedDone, plan.record.electiveChoices],
  );
  return (
    <Card aria-labelledby="key-title">
      <CardHeader
        titleId="key-title"
        eyebrow="Key courses"
        title="Don't put these off"
        description="Ranked by how many later courses wait on them. A simple measure, not a guarantee."
      />
      <CardBody>
        {top.length === 0 ? (
          <p className="text-sm text-muted">None of your remaining courses hold up others.</p>
        ) : (
          <ol className="space-y-3">
            {top.map((impact, i) => {
              const state = plan.states.get(impact.code)!;
              return (
                <li key={impact.code} className="flex items-start gap-3">
                  <span className="num mt-0.5 text-xs text-dim">{String(i + 1).padStart(2, "0")}</span>
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => onOpenCourse(impact.code)}
                      className="text-left text-sm font-medium text-fg hover:text-accent"
                    >
                      {impact.title}
                    </button>
                    <p className="text-[12.5px] text-muted">
                      {plural(impact.downstream.length, "later course")} depend on it · chain of {impact.chainLength}
                    </p>
                  </div>
                  <StatusBadge status={state.status} compact />
                </li>
              );
            })}
          </ol>
        )}
      </CardBody>
    </Card>
  );
}
