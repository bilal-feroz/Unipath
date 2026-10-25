"use client";

import { Flag, GraduationCap, Printer, Sun, TriangleAlert } from "lucide-react";
import { usePlanContext } from "@/components/app-shell/plan-context";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { useAppStore } from "@/lib/state/store";
import { cn, plural } from "@/lib/utils";
import { usePlanItemLabel } from "./plan-item-label";
import { LOAD_OPTIONS } from "./planning-settings";

export function RoadmapView({ onOpenCourse }: { onOpenCourse: (code: string) => void }) {
  const plan = usePlanContext();
  const label = usePlanItemLabel();
  const setPreferences = useAppStore((s) => s.setPreferences);
  const { roadmap, settings, progress } = plan;
  const total = plan.curriculum.totalCredits;

  return (
    <div>
      <Card className="print:hidden">
        <CardBody className="grid gap-5 pt-5 md:grid-cols-[auto_1fr] md:items-center">
          <div>
            <p className="num text-[11px] font-semibold uppercase tracking-[0.12em] text-dim">Credit hours per semester</p>
            <Segmented
              className="mt-2"
              label="Credit hours per semester"
              value={settings.maxCredits}
              onChange={(v) => setPreferences({ maxCredits: v })}
              options={LOAD_OPTIONS}
            />
          </div>
          <div className="md:max-w-sm md:justify-self-end">
            <Switch
              checked={settings.includeSummer}
              onChange={(v) => setPreferences({ includeSummer: v })}
              label="Study in summer"
              description={`Up to ${settings.summerMaxCredits} credit hours per summer (change in Planning settings).`}
            />
          </div>
        </CardBody>
      </Card>

      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight">
              {progress.complete
                ? "All requirements complete"
                : roadmap.graduationTerm
                  ? `Estimated graduation: ${roadmap.semesters.at(-1)!.label}`
                  : "No complete plan found"}
            </h2>
            <Pill tone="accent">Estimate</Pill>
          </div>
          {!progress.complete && roadmap.graduationTerm && (
            <p className="mt-1.5 max-w-2xl text-sm text-muted">
              {plural(roadmap.semesterCount, "semester")} · {roadmap.remainingCredits} credit hours to go.{" "}
              {roadmap.provablyFastest
                ? `This is the earliest possible finish with these settings: your remaining credits and prerequisite chains need at least ${plural(roadmap.lowerBound, "semester")}.`
                : "Built step by step so that the longest prerequisite chains start first. Another combination might finish sooner; this is a careful estimate, not a promise."}
            </p>
          )}
          <p className="mt-1 text-[13px] text-dim">
            Assumes each course is offered when it&apos;s planned and that you pass everything.
          </p>
        </div>
        <Button variant="secondary" className="print:hidden" onClick={() => window.print()}>
          <Printer /> Print or save as PDF
        </Button>
      </div>

      {roadmap.blocked && (
        <div role="alert" className="mt-4 flex gap-3 rounded-xl border border-warn/35 bg-warn-soft p-4 text-sm">
          <TriangleAlert aria-hidden className="size-4 shrink-0 text-warn" />
          <p>{roadmap.blocked.message}</p>
        </div>
      )}

      <ol className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Semester-by-semester plan">
        {roadmap.semesters.map((sem, i) => (
          <li key={sem.index} className="break-inside-avoid">
            <section
              aria-labelledby={`sem-${sem.index}`}
              className={cn(
                "flex h-full flex-col rounded-2xl border bg-surface",
                i === 0 ? "border-plan/40" : "border-line",
              )}
            >
              <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="num text-xs text-dim">{String(i + 1).padStart(2, "0")}</span>
                  <h3 id={`sem-${sem.index}`} className="font-semibold text-fg">
                    {sem.label}
                  </h3>
                  {sem.isSummer && (
                    <Pill tone="warn">
                      <Sun aria-hidden className="size-3" /> Summer
                    </Pill>
                  )}
                  {i === 0 && <Pill tone="plan">Next</Pill>}
                </div>
                <span className="num text-xs text-muted">{sem.credits} cr</span>
              </header>
              <ul className="flex-1 space-y-1.5 px-4 py-3">
                {sem.items.map(({ item, failed, retake }) => {
                  const l = label(item);
                  return (
                    <li key={`${item.id}-${failed ? "f" : ""}`} className="flex items-baseline gap-2 text-sm">
                      <span className="num w-[62px] shrink-0 text-[11px] text-dim">{l.isSlot ? "ELECT." : l.code}</span>
                      {l.isSlot ? (
                        <span className="text-muted">{l.title}</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onOpenCourse(l.code)}
                          className="text-left text-fg hover:text-accent"
                        >
                          {l.title}
                          {retake && <span className="text-warn"> (retake)</span>}
                          {failed && <span className="text-danger"> (not passed)</span>}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
              <footer className="border-t border-line px-4 py-3">
                {sem.milestones.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {sem.milestones.map((m) => (
                      <Pill key={m} tone={m.startsWith("Degree") ? "done" : "neutral"}>
                        {m.startsWith("Degree") ? <GraduationCap aria-hidden className="size-3" /> : <Flag aria-hidden className="size-3" />}
                        {m}
                      </Pill>
                    ))}
                  </div>
                )}
                <ProgressBar size="sm" value={sem.countedAfter} max={total} label={`After ${sem.label}: ${sem.countedAfter} of ${total} credit hours`} />
                <p className="num mt-1.5 text-[11.5px] text-muted">
                  {sem.remainingAfter > 0 ? `${sem.remainingAfter} credit hours left after this` : "Degree requirements complete"}
                </p>
              </footer>
            </section>
          </li>
        ))}
      </ol>
    </div>
  );
}
