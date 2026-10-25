"use client";

import { ExternalLink, Hourglass, Info, ListChecks } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/app-shell/app-shell";
import { usePlanContext } from "@/components/app-shell/plan-context";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { getUniversity } from "@/lib/curriculum/registry";
import type { GradingScale } from "@/lib/gpa/scales";
import { useAppStore } from "@/lib/state/store";
import { cn, plural } from "@/lib/utils";
import { GpaForecastCard } from "./gpa-forecast";
import { GpaAttemptsCard, GpaHistoryCard, SEMESTER_OPTIONS } from "./gpa-history";
import { RATING_TONE, useGpa } from "./use-gpa";

/** A 0–4 track split into the official rating bands, with a marker at the student's CGPA. */
function GpaGauge({ value, scale }: { value: number | null; scale: GradingScale }) {
  const bands = [...scale.ratings].reverse(); // lowest first
  const pct = (v: number) => `${(v / scale.maxPoints) * 100}%`;
  return (
    <div className="mt-6" aria-hidden>
      <div className="relative h-3 overflow-hidden rounded-full bg-surface-2">
        {bands.map((band, i) => {
          const end = i < bands.length - 1 ? bands[i + 1].min : scale.maxPoints;
          return (
            <div
              key={band.label}
              className={cn(
                "absolute inset-y-0 border-r border-bg/60",
                ["bg-danger/35", "bg-warn/40", "bg-open/40", "bg-accent/45", "bg-done/55"][i] ?? "bg-surface-2",
              )}
              style={{ left: pct(band.min), width: `calc(${pct(end)} - ${pct(band.min)})` }}
            />
          );
        })}
        {value !== null && (
          <div
            className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-bg bg-fg shadow-lg transition-[left] duration-700"
            style={{ left: pct(value) }}
          />
        )}
      </div>
      <div className="num mt-2 flex justify-between text-[11px] text-dim">
        <span>0.0</span>
        {bands.slice(1).map((b) => (
          <span key={b.label} className="hidden sm:inline">
            {b.min.toFixed(1)}
          </span>
        ))}
        <span>{scale.maxPoints.toFixed(1)}</span>
      </div>
    </div>
  );
}

export function GpaScreen() {
  const plan = usePlanContext();
  const setGrade = useAppStore((s) => s.setGrade);
  const setGradeTerm = useAppStore((s) => s.setGradeTerm);
  const { scale, result, policy } = useGpa();
  const university = getUniversity(plan.curriculum.universityId);

  if (!scale || !result) {
    return (
      <div className="page-in mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <PageHeader title="Your GPA" />
        <p className="mt-6 text-muted">
          UniPath doesn&apos;t have a verified grading scale for {university?.name ?? "this university"} yet, so it
          can&apos;t calculate a GPA.
        </p>
      </div>
    );
  }

  const groups = plan.curriculum.groups
    .map((g) => ({ group: g, courses: g.courses.filter((c) => plan.completed.has(c)).map((c) => plan.index.byCode.get(c)!) }))
    .filter((g) => g.courses.length > 0);
  const pointsBySymbol = new Map(scale.passingGrades.map((g) => [g.symbol, g.points]));

  return (
    <div className="page-in mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Your GPA"
        description={`Add your grades to see your CGPA on ${university?.shortName ?? "your university"}'s official ${scale.maxPoints.toFixed(1)} scale.`}
      />

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card aria-labelledby="cgpa-title">
            <CardHeader titleId="cgpa-title" title="Cumulative GPA" />
            <CardBody>
              <div className="flex flex-wrap items-end gap-x-5 gap-y-2">
                <p className="num text-6xl font-semibold tracking-tight text-fg" data-testid="cgpa">
                  {result.cgpa !== null ? result.cgpa.toFixed(2) : "—"}
                </p>
                <div className="pb-2">
                  {result.rating ? (
                    <Pill tone={RATING_TONE[result.rating] ?? "neutral"} data-testid="cgpa-rating">
                      {result.rating}
                    </Pill>
                  ) : (
                    <Pill>No grades yet</Pill>
                  )}
                  <p className="mt-1.5 text-sm text-muted">
                    {result.gradedCredits > 0
                      ? `From ${plural(result.gradedCredits, "credit hour")} across ${plural(result.gradedCourses, "graded course")}.`
                      : "Pick a grade for at least one completed course below."}
                  </p>
                </div>
              </div>
              <GpaGauge value={result.cgpa} scale={scale} />

              {result.ungraded.length > 0 && (
                <p role="status" className="mt-5 flex gap-2.5 rounded-xl border border-warn/30 bg-warn-soft px-3.5 py-2.5 text-sm text-fg">
                  <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-warn" />
                  {plural(result.ungraded.length, "completed course")} {result.ungraded.length === 1 ? "has" : "have"} no grade
                  yet, so {result.ungraded.length === 1 ? "it isn't" : "they aren't"} in your CGPA.
                </p>
              )}
              {result.notCounted.length > 0 && (
                <p className="mt-3 text-[13px] text-muted">
                  {plural(result.notCounted.length, "course")} marked Pass or Transfer {result.notCounted.length === 1 ? "doesn't" : "don't"} count toward the GPA.
                </p>
              )}
              {result.attemptsCounted > 0 && (
                <p className="mt-3 text-[13px] text-muted">
                  Includes {plural(result.attemptsCounted, "earlier attempt")} of repeated or failed courses ({policy === "all" ? "every attempt counts" : "latest attempt only"} — your setting).
                </p>
              )}
            </CardBody>
          </Card>

          <GpaForecastCard />

          <Card aria-labelledby="grades-title">
            <CardHeader
              titleId="grades-title"
              title="Your grades"
              description="Saved in this browser only."
            />
            <CardBody>
              {groups.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line-strong px-5 py-10 text-center">
                  <ListChecks aria-hidden className="mx-auto size-7 text-dim" />
                  <p className="mt-3 font-medium text-fg">No completed courses yet</p>
                  <p className="mt-1 text-sm text-muted">Tick the courses you&apos;ve finished, then come back to add grades.</p>
                  <Button asChild variant="secondary" className="mt-4">
                    <Link href="/courses">Go to My Courses</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-5">
                  {groups.map(({ group, courses }) => (
                    <section key={group.id} aria-labelledby={`gpa-${group.id}`}>
                      <h3 id={`gpa-${group.id}`} className="mb-2 text-[12.5px] font-medium text-muted">
                        {group.title}
                      </h3>
                      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
                        {courses.map((course) => {
                          const grade = plan.record.grades[course.code] ?? "";
                          const points = pointsBySymbol.get(grade);
                          return (
                            <li key={course.code} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-2.5">
                              <span className="num w-[68px] shrink-0 text-xs text-dim">{course.code}</span>
                              <span className="min-w-0 flex-1 text-sm text-fg">{course.title}</span>
                              <span className="num w-10 shrink-0 text-right text-xs text-muted">{course.credits} cr</span>
                              <Select
                                label={`Grade for ${course.title}`}
                                value={grade}
                                onChange={(e) => setGrade(course.code, e.target.value || null)}
                                className="h-9 w-[124px] shrink-0 text-[13px]"
                              >
                                <option value="">No grade</option>
                                {scale.passingGrades.map((g) => (
                                  <option key={g.symbol} value={g.symbol}>
                                    {g.label}
                                  </option>
                                ))}
                              </Select>
                              <Select
                                label={`Semester for ${course.title}`}
                                value={plan.record.gradeTerms[course.code] ?? ""}
                                onChange={(e) => setGradeTerm(course.code, e.target.value ? Number(e.target.value) : null)}
                                className="h-9 w-[92px] shrink-0 text-[13px]"
                              >
                                <option value="">Sem —</option>
                                {SEMESTER_OPTIONS.map((n) => (
                                  <option key={n} value={n}>
                                    Sem {n}
                                  </option>
                                ))}
                              </Select>
                              <span className="num w-16 shrink-0 text-right text-xs text-muted">
                                {points != null ? `${(points * course.credits).toFixed(1)} pts` : "—"}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
              {plan.inProgress.size > 0 && (
                <p className="mt-5 flex gap-2.5 text-[13px] text-muted">
                  <Hourglass aria-hidden className="mt-0.5 size-4 shrink-0 text-now" />
                  You&apos;re taking {plural(plan.inProgress.size, "course")} this semester. Mark {plan.inProgress.size === 1 ? "it" : "them"}{" "}
                  as completed in My Courses once results are out, then add the grade here.
                </p>
              )}
            </CardBody>
          </Card>

          <GpaHistoryCard />
          <GpaAttemptsCard />
        </div>

        <Card aria-labelledby="scale-title" className="self-start">
          <CardHeader titleId="scale-title" title="Grading scale" description={scale.name} />
          <CardBody>
            <table className="w-full text-sm">
              <caption className="sr-only">Grade points</caption>
              <thead>
                <tr className="text-left text-[12.5px] font-medium text-muted">
                  <th className="pb-2 font-semibold">Grade</th>
                  <th className="pb-2 font-semibold">Mark</th>
                  <th className="pb-2 text-right font-semibold">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[...scale.passingGrades, ...scale.failingGrades].map((g) => (
                  <tr key={g.symbol}>
                    <td className="py-1.5 font-medium text-fg">{g.label}</td>
                    <td className="num py-1.5 text-muted">{g.range ?? "—"}</td>
                    <td className="num py-1.5 text-right text-fg">{g.points != null ? g.points.toFixed(1) : "not counted"}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3 className="mt-5 text-[12.5px] font-medium text-muted">Ratings</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {scale.ratings.map((r, i) => {
                const upper = i === 0 ? scale.maxPoints : scale.ratings[i - 1].min - 0.01;
                return (
                  <li key={r.label} className="flex justify-between gap-3">
                    <span className="text-fg">{r.label}</span>
                    <span className="num text-muted">
                      {r.min === 0 ? `below ${scale.ratings[i - 1].min.toFixed(1)}` : `${r.min.toFixed(2)} – ${upper.toFixed(2)}`}
                    </span>
                  </li>
                );
              })}
            </ul>

            <ul className="mt-5 space-y-2 text-[12.5px] leading-relaxed text-muted">
              {scale.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
            <a
              href={scale.source.url}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-strong"
            >
              Source: {scale.source.title} <ExternalLink aria-hidden className="size-3.5" />
            </a>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
