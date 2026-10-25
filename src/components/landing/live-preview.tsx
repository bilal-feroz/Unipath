"use client";

import { GraduationCap } from "lucide-react";
import { useMemo } from "react";
import { StatusBadge } from "@/components/courses/status-badge";
import { Pill } from "@/components/ui/pill";
import { ProgressBar } from "@/components/ui/progress-bar";
import { getCurriculum } from "@/lib/curriculum/registry";
import { computePlan } from "@/lib/plan";
import { DEMO_CURRICULUM_ID, demoProfile } from "@/lib/state/demo";

/** A real, read-only render of the sample student's plan, computed by the planning engine. */
export function LivePreview() {
  const plan = useMemo(() => {
    const profile = demoProfile();
    return computePlan(getCurriculum(DEMO_CURRICULUM_ID)!, profile.progress[DEMO_CURRICULUM_ID], profile.preferences);
  }, []);
  const next = plan.nextItems.filter((s) => s.item.kind === "course").slice(0, 4);
  const locked = [...plan.states.values()].filter((s) => s.status === "locked" && !s.notNeeded).slice(0, 1);

  return (
    <div className="grid gap-3 p-4 sm:grid-cols-5 sm:p-5">
      <div className="glass rounded-xl border border-line p-4 sm:col-span-3">
        <p className="num text-[10.5px] font-semibold uppercase tracking-[0.12em] text-dim">Degree progress</p>
        <p className="mt-2 flex items-baseline gap-2">
          <span className="num text-3xl font-semibold">{plan.progress.countedCredits}</span>
          <span className="text-sm text-muted">of {plan.progress.totalCredits} credit hours</span>
        </p>
        <ProgressBar
          className="mt-3"
          value={plan.progress.countedCredits}
          max={plan.progress.totalCredits}
          label="Sample student's degree progress"
        />
        <p className="num mt-4 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-dim">
          Next semester · {plan.roadmap.semesters[0]?.label}
        </p>
        <ul className="mt-2 space-y-1.5">
          {next.map(({ item }) => (
            <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate">{plan.index.byCode.get(item.id)?.title}</span>
              <StatusBadge status="planned" compact />
            </li>
          ))}
          {locked.map((s) => (
            <li key={s.code} className="flex items-center justify-between gap-3 text-sm text-muted">
              <span className="truncate">{plan.index.byCode.get(s.code)?.title}</span>
              <StatusBadge status="locked" compact />
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-3 sm:col-span-2">
        <div className="glass rounded-xl border border-line p-4">
          <div className="flex items-center justify-between">
            <p className="num text-[10.5px] font-semibold uppercase tracking-[0.12em] text-dim">Estimated graduation</p>
            <Pill tone="accent">Estimate</Pill>
          </div>
          <p className="mt-2 flex items-center gap-2 text-xl font-semibold">
            <GraduationCap aria-hidden className="size-5 text-accent" />
            {plan.roadmap.semesters.at(-1)?.label}
          </p>
          <p className="mt-1 text-[13px] text-muted">{plan.roadmap.semesterCount} semesters at up to 18 credits</p>
        </div>
        {plan.insight && (
          <div className="glass rounded-xl border border-line p-4">
            <p className="num text-[10.5px] font-semibold uppercase tracking-[0.12em] text-dim">Insight</p>
            <p className="mt-2 text-[13px] leading-relaxed text-fg">{plan.insight.message}</p>
          </div>
        )}
      </div>
    </div>
  );
}
