"use client";

import { Hourglass, Target } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { usePlanContext } from "@/components/app-shell/plan-context";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { Field, Input } from "@/components/ui/form";
import { Pill } from "@/components/ui/pill";
import { courseImpact, forecastCgpa, pointGrades, requiredForTarget, type GradeInputs } from "@/lib/gpa/forecast";
import { roundGpa } from "@/lib/gpa/gpa";
import type { GradingScale } from "@/lib/gpa/scales";
import { useAppStore, type ForecastScenario } from "@/lib/state/store";
import { cn } from "@/lib/utils";
import { useGpa } from "./use-gpa";

const SCENARIOS: { key: ForecastScenario; label: string }[] = [
  { key: "best", label: "Best case" },
  { key: "expected", label: "Expected" },
  { key: "worst", label: "Worst case" },
];

function fmt(v: number | null) {
  return v === null ? "—" : v.toFixed(2);
}

function TargetBox({ inputs, current, scale }: { inputs: GradeInputs; current: { code: string; credits: number }[]; scale: GradingScale }) {
  const plan = usePlanContext();
  const { policy, result } = useGpa();
  const saved = useAppStore((s) => (s.activeProfile === "demo" ? s.demo : s.personal)?.life.gpaTarget ?? null);
  const [text, setText] = useState(saved?.toFixed(2) ?? "");
  const target = Number(text);
  const valid = text !== "" && target > 0 && target <= scale.maxPoints;
  const now = valid ? requiredForTarget(inputs, current, target, policy) : null;
  const remaining = plan.progress.remainingCredits;
  // Over the rest of the degree: the average needed across every credit still to take.
  const byGraduation =
    valid && result && remaining > 0 ? Math.max(0, ((target - 0.005) * (result.gradedCredits + remaining) - result.qualityPoints) / remaining) : null;

  return (
    <div className="rounded-xl border border-line bg-bg/40 p-3.5">
      <p className="flex items-center gap-1.5 text-sm font-medium text-fg">
        <Target aria-hidden className="size-4 text-accent" /> What do I need for a target CGPA?
      </p>
      <div className="mt-2 flex flex-wrap items-end gap-3">
        <Field label="Target CGPA" className="w-32">
          {(id) => (
            <Input
              id={id}
              type="number"
              inputMode="decimal"
              step={0.01}
              min={0}
              max={scale.maxPoints}
              placeholder="e.g. 3.80"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                const v = Number(e.target.value);
                useAppStore.getState().updateLife((l) => ({ ...l, gpaTarget: e.target.value && v > 0 && v <= scale.maxPoints ? v : null }));
              }}
            />
          )}
        </Field>
      </div>
      {valid && (
        <div className="mt-3 space-y-1.5 text-sm" data-testid="target-result">
          {current.length > 0 && now ? (
            now.alreadyMet ? (
              <p className="text-fg">You&apos;ll reach {target.toFixed(2)} even with the lowest passing grade in every current course.</p>
            ) : now.achievable ? (
              <p className="text-fg">
                This semester you need an average of <span className="num font-semibold">{roundGpa(now.neededAverage).toFixed(2)}</span> grade points
                {now.uniformGrade && (
                  <>
                    {" "}— for example <span className="font-semibold">{now.uniformGrade.label}</span> or better in every course
                  </>
                )}
                .
              </p>
            ) : (
              <p className="text-warn">Not reachable this semester: it would need {roundGpa(now.neededAverage).toFixed(2)} points on average, above the {scale.maxPoints.toFixed(1)} maximum.</p>
            )
          ) : (
            <p className="text-muted">Mark this semester&apos;s courses as taking now to see what they need.</p>
          )}
          {byGraduation !== null && (
            <p className="text-muted">
              Over the rest of your degree ({remaining} credit hours):{" "}
              {byGraduation > scale.maxPoints ? (
                <span className="text-warn">not reachable.</span>
              ) : (
                <>
                  an average of <span className="num text-fg">{roundGpa(byGraduation).toFixed(2)}</span>.
                </>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Predicted CGPA from expected grades in this semester's courses. Never changes recorded grades. */
export function GpaForecastCard() {
  const plan = usePlanContext();
  const { scale, result, inputs, policy } = useGpa();
  if (!scale || !result || !inputs) return null;
  const current = [...plan.inProgress].map((code) => ({ code, credits: plan.index.byCode.get(code)!.credits }));
  const grades = pointGrades(scale);
  const forecast = plan.record.forecast;
  const results = Object.fromEntries(SCENARIOS.map((s) => [s.key, forecastCgpa(inputs, forecast[s.key], policy)]));
  const impact = current.length ? courseImpact(inputs, current, forecast.expected, policy, grades[0].symbol, grades.at(-1)!.symbol) : [];

  return (
    <Card aria-labelledby="forecast-title">
      <CardHeader
        titleId="forecast-title"
        title="GPA forecast"
        description="Pick the grades you might get this semester. These are predictions — your recorded CGPA doesn't change."
      />
      <CardBody className="space-y-4">
        {current.length === 0 ? (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-line-strong px-4 py-4 text-sm">
            <Hourglass aria-hidden className="size-5 text-now" />
            <span className="min-w-0 flex-1 text-muted">Mark the courses you&apos;re taking now to forecast your CGPA.</span>
            <Button asChild size="sm" variant="secondary">
              <Link href="/courses">My Courses</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <caption className="sr-only">Expected grades for this semester&apos;s courses</caption>
                <thead>
                  <tr className="text-left text-[12.5px] font-medium text-muted">
                    <th className="pb-2 font-medium">Course</th>
                    {SCENARIOS.map((s) => (
                      <th key={s.key} className="pb-2 font-medium">
                        {s.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {current.map((c) => {
                    const course = plan.index.byCode.get(c.code)!;
                    return (
                      <tr key={c.code}>
                        <td className="py-2 pr-3">
                          <span className="text-fg">{course.title}</span> <span className="num text-xs text-dim">{c.credits} cr</span>
                        </td>
                        {SCENARIOS.map((s) => (
                          <td key={s.key} className="py-2 pr-2">
                            <Select
                              label={`${s.label} grade for ${course.title}`}
                              value={forecast[s.key][c.code] ?? ""}
                              onChange={(e) => useAppStore.getState().setForecastGrade(s.key, c.code, e.target.value || null)}
                              className="h-9 w-[92px] text-[13px]"
                            >
                              <option value="">—</option>
                              {grades.map((g) => (
                                <option key={g.symbol} value={g.symbol}>
                                  {g.label}
                                </option>
                              ))}
                            </Select>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-line-strong">
                    <th scope="row" className="pt-3 text-left text-[13px] font-medium text-muted">
                      Predicted CGPA
                    </th>
                    {SCENARIOS.map((s) => (
                      <td key={s.key} className="pt-3">
                        <span className="num text-lg font-semibold text-fg" data-testid={`predicted-${s.key}`}>
                          {fmt(results[s.key].cgpa)}
                        </span>
                        {results[s.key].semesterGpa !== null && <span className="num block text-[11.5px] text-muted">semester {fmt(results[s.key].semesterGpa)}</span>}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="text-[12.5px] text-muted">
              Recorded CGPA: <span className="num text-fg">{fmt(result.cgpa)}</span>. Courses without a grade in a column are left out of that column.
            </p>
            {impact.length > 1 && (
              <div>
                <p className="text-sm font-medium text-fg">Which course matters most</p>
                <p className="text-[12.5px] text-muted">
                  How far each course alone can move your CGPA, from {grades[0].label} to {grades.at(-1)!.label}, with the others at your expected grades.
                </p>
                <ul className="mt-2 space-y-1.5">
                  {impact.map((i, n) => {
                    const max = impact[0].swing || 1;
                    return (
                      <li key={i.code} className="flex items-center gap-3 text-[13px]">
                        <span className="min-w-0 flex-1 truncate text-fg">{plan.index.byCode.get(i.code)!.title}</span>
                        <span className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                          <span className={cn("block h-full rounded-full", n === 0 ? "bg-accent" : "bg-open")} style={{ width: `${(i.swing / max) * 100}%` }} />
                        </span>
                        <span className="num w-28 shrink-0 text-right text-muted">
                          {fmt(i.worst)} – {fmt(i.best)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </>
        )}
        <TargetBox inputs={inputs} current={current} scale={scale} />
        <p className="text-[12px] text-dim">
          <Pill className="mr-1.5">Predicted</Pill>
          Calculated with your university&apos;s grade points and each course&apos;s credit hours. No AI is involved.
        </p>
      </CardBody>
    </Card>
  );
}
