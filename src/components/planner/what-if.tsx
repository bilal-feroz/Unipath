"use client";

import { ArrowRight, Check, FlaskConical, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { usePlanContext } from "@/components/app-shell/plan-context";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { courseName, isEmptyScenario, keyCourses, simulateScenario, type Scenario } from "@/lib/engine";
import { useAppStore } from "@/lib/state/store";
import { cn, plural } from "@/lib/utils";
import { LOAD_OPTIONS } from "./planning-settings";

export function WhatIf() {
  const plan = usePlanContext();
  const setPreferences = useAppStore((s) => s.setPreferences);
  const [scenario, setScenario] = useState<Scenario>({});
  const { settings } = plan;

  const roadmapCourses = useMemo(
    () =>
      plan.roadmap.semesters.flatMap((s) =>
        s.items.flatMap(({ item }) => (item.kind === "course" ? [{ code: item.code, term: s.label }] : [])),
      ),
    [plan.roadmap],
  );
  const keyCourse = useMemo(() => {
    const next = new Set(plan.plannedCodes);
    return keyCourses(plan.index, plan.assumedDone, plan.record.electiveChoices, 10).find((k) => next.has(k.code))?.code;
  }, [plan]);

  const result = useMemo(
    () => (isEmptyScenario(scenario) ? null : simulateScenario(plan.baseInput, scenario)),
    [plan.baseInput, scenario],
  );

  const update = (patch: Partial<Scenario>) => setScenario((s) => ({ ...s, ...patch }));
  const workload = scenario.maxCredits ?? settings.maxCredits;
  const summer = scenario.includeSummer ?? settings.includeSummer;
  const canApply =
    (scenario.maxCredits !== undefined && scenario.maxCredits !== settings.maxCredits) ||
    (scenario.includeSummer !== undefined && scenario.includeSummer !== settings.includeSummer);

  const presets: { label: string; scenario: Scenario }[] = [
    { label: "Lighter load (12 credits)", scenario: { maxCredits: 12 } },
    { label: "Heavier load (21 credits)", scenario: { maxCredits: 21 } },
    { label: "Study in summers", scenario: { includeSummer: true } },
    ...(keyCourse
      ? [
          { label: `Postpone ${courseName(plan.index, keyCourse)}`, scenario: { postpone: { code: keyCourse, semesters: 1 } } },
          { label: `Retake ${courseName(plan.index, keyCourse)}`, scenario: { retake: keyCourse } },
        ]
      : []),
  ];

  if (plan.progress.complete) {
    return <p className="text-sm text-muted">Every requirement is complete — there&apos;s nothing to simulate.</p>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <Card aria-labelledby="sim-controls">
        <CardHeader
          titleId="sim-controls"
          eyebrow="Simulation"
          title="Try a change"
          description="Nothing here touches your saved plan unless you press Apply."
        />
        <CardBody className="space-y-6">
          <div>
            <p className="text-sm font-medium text-fg">Quick scenarios</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {presets.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setScenario(p.scenario)}
                  className="max-w-full truncate rounded-lg border border-line bg-bg/50 px-3 py-1.5 text-left text-[13px] text-muted hover:border-accent/50 hover:text-fg"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-fg">Credit hours per semester</p>
            <Segmented
              className="mt-2"
              label="Simulated credit hours per semester"
              value={workload}
              onChange={(v) => update({ maxCredits: v === settings.maxCredits ? undefined : v })}
              options={LOAD_OPTIONS.map((o) => ({ ...o, label: o.value === settings.maxCredits ? `${o.label}•` : o.label }))}
            />
            <p className="mt-1.5 text-[12px] text-dim">• your current setting</p>
          </div>

          <Switch
            checked={summer}
            onChange={(v) => update({ includeSummer: v === settings.includeSummer ? undefined : v })}
            label="Study in summer"
            description={`Up to ${settings.summerMaxCredits} credit hours per summer.`}
          />

          <div>
            <label htmlFor="postpone-course" className="text-sm font-medium text-fg">
              Postpone a course
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              <Select
                id="postpone-course"
                label="Course to postpone"
                className="min-w-0 flex-1"
                value={scenario.postpone?.code ?? ""}
                onChange={(e) =>
                  update({ postpone: e.target.value ? { code: e.target.value, semesters: scenario.postpone?.semesters ?? 1 } : null })
                }
              >
                <option value="">No course</option>
                {roadmapCourses.map((c) => (
                  <option key={c.code} value={c.code}>
                    {courseName(plan.index, c.code)} ({c.term})
                  </option>
                ))}
              </Select>
              <Select
                label="Postpone by"
                className="w-36"
                disabled={!scenario.postpone}
                value={String(scenario.postpone?.semesters ?? 1)}
                onChange={(e) =>
                  scenario.postpone && update({ postpone: { ...scenario.postpone, semesters: Number(e.target.value) } })
                }
              >
                <option value="1">by 1 semester</option>
                <option value="2">by 2 semesters</option>
              </Select>
            </div>
          </div>

          <div>
            <label htmlFor="retake-course" className="text-sm font-medium text-fg">
              Need to retake a course
            </label>
            <Select
              id="retake-course"
              label="Course to retake"
              className="mt-2 w-full"
              value={scenario.retake ?? ""}
              onChange={(e) => update({ retake: e.target.value || null })}
            >
              <option value="">No course</option>
              {roadmapCourses.map((c) => (
                <option key={c.code} value={c.code}>
                  {courseName(plan.index, c.code)} ({c.term})
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-line pt-5">
            <Button variant="secondary" onClick={() => setScenario({})} disabled={isEmptyScenario(scenario)}>
              <RotateCcw /> Reset simulation
            </Button>
            {canApply && (
              <Button
                onClick={() => {
                  setPreferences({
                    ...(scenario.maxCredits !== undefined ? { maxCredits: scenario.maxCredits } : {}),
                    ...(scenario.includeSummer !== undefined ? { includeSummer: scenario.includeSummer } : {}),
                  });
                  setScenario({ ...scenario, maxCredits: undefined, includeSummer: undefined });
                  toast("Applied to your plan", { description: "Your workload settings were updated." });
                }}
              >
                <Check /> Apply workload to my plan
              </Button>
            )}
          </div>
        </CardBody>
      </Card>

      <section aria-labelledby="sim-result" aria-live="polite" className="min-w-0">
        <h2 id="sim-result" className="sr-only">
          Simulation result
        </h2>
        {!result ? (
          <div className="flex h-full min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong px-6 py-12 text-center">
            <FlaskConical aria-hidden className="size-8 text-dim" />
            <p className="mt-3 font-medium text-fg">Pick a scenario to compare</p>
            <p className="mt-1 max-w-sm text-sm text-muted">
              See how a lighter load, summer classes, a postponed course or a retake would change your graduation estimate.
            </p>
          </div>
        ) : (
          <Card>
            <CardBody className="pt-5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-muted">Estimated graduation</p>
                <Pill
                  tone={result.graduationChange === "later" ? "warn" : result.graduationChange === "earlier" ? "done" : "neutral"}
                  data-testid="sim-change"
                >
                  {result.graduationChange === "later"
                    ? "Later"
                    : result.graduationChange === "earlier"
                      ? "Earlier"
                      : result.graduationChange === "same"
                        ? "No change"
                        : "Can't compare"}
                </Pill>
              </div>
              <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div className="rounded-xl border border-line bg-bg/40 p-3.5">
                  <p className="num text-[10.5px] uppercase tracking-[0.12em] text-dim">Current plan</p>
                  <p className="mt-1 text-xl font-semibold text-fg" data-testid="sim-baseline">
                    {result.baseline.semesters.at(-1)?.label ?? "—"}
                  </p>
                  <p className="num mt-1 text-xs text-muted">
                    {plural(result.baseline.semesterCount, "semester")} · avg {result.averageLoad.baseline} cr
                  </p>
                </div>
                <ArrowRight aria-hidden className="size-5 text-dim" />
                <div
                  className={cn(
                    "rounded-xl border p-3.5",
                    result.graduationChange === "later"
                      ? "border-warn/40 bg-warn-soft"
                      : result.graduationChange === "earlier"
                        ? "border-done/40 bg-done-soft"
                        : "border-line bg-bg/40",
                  )}
                >
                  <p className="num text-[10.5px] uppercase tracking-[0.12em] text-dim">What if</p>
                  <p className="mt-1 text-xl font-semibold text-fg" data-testid="sim-result-term">
                    {result.simulated.blocked ? "No plan" : (result.simulated.semesters.at(-1)?.label ?? "—")}
                  </p>
                  <p className="num mt-1 text-xs text-muted">
                    {plural(result.simulated.semesterCount, "semester")} · avg {result.averageLoad.simulated} cr
                  </p>
                </div>
              </div>

              <h3 className="num mt-6 text-[11px] font-semibold uppercase tracking-[0.12em] text-dim">Why</h3>
              <ul className="mt-2 space-y-1.5">
                {result.reasons.map((r) => (
                  <li key={r} className="flex gap-2 text-sm text-fg">
                    <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
                    {r}
                  </li>
                ))}
              </ul>

              <h3 className="num mt-6 text-[11px] font-semibold uppercase tracking-[0.12em] text-dim">
                Courses affected ({result.affected.length})
              </h3>
              {result.affected.length === 0 ? (
                <p className="mt-2 text-sm text-muted">No course moves.</p>
              ) : (
                <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
                  {result.affected.slice(0, 8).map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3.5 py-2.5 text-sm">
                      <span className="min-w-0 text-fg">{a.title}</span>
                      <span className="num text-xs text-muted">
                        {a.from ?? "—"} <span aria-hidden>→</span>
                        <span className="sr-only">moves to</span>{" "}
                        <span className={a.shift > 0 ? "text-warn" : "text-done"}>{a.to ?? "not scheduled"}</span>
                      </span>
                    </li>
                  ))}
                  {result.affected.length > 8 && (
                    <li className="px-3.5 py-2.5 text-[13px] text-muted">and {result.affected.length - 8} more</li>
                  )}
                </ul>
              )}
              <p className="mt-4 text-[12.5px] text-dim">
                Simulation only — your saved progress and plan are unchanged.
              </p>
            </CardBody>
          </Card>
        )}
      </section>
    </div>
  );
}
