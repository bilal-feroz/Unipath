"use client";

import { ArrowRight, ChevronDown, Gauge, GraduationCap, Hourglass, Lightbulb, ListChecks, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell/app-shell";
import { usePlanContext } from "@/components/app-shell/plan-context";
import { CourseDetailDialog } from "@/components/courses/course-detail-dialog";
import { RATING_TONE, useGpa } from "@/components/gpa/use-gpa";
import { usePlanItemLabel } from "@/components/planner/plan-item-label";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { ProgressBar } from "@/components/ui/progress-bar";
import { getUniversity } from "@/lib/curriculum/registry";
import { cn, plural } from "@/lib/utils";

function ProgressCard() {
  const { progress, inProgress, inProgressCredits } = usePlanContext();
  const { scale, result: gpa } = useGpa();
  const [open, setOpen] = useState(false);
  return (
    <Card className="lg:col-span-2" aria-labelledby="progress-title">
      <CardHeader titleId="progress-title" title="Degree progress" />
      <CardBody>
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <p className="flex items-baseline gap-2">
            <span className="num text-5xl font-semibold tracking-tight text-fg">{progress.countedCredits}</span>
            <span className="text-muted">of {progress.totalCredits} credit hours</span>
          </p>
          <p className="num text-2xl font-semibold text-accent">{progress.percent}%</p>
        </div>
        <ProgressBar
          className="mt-4"
          size="lg"
          value={progress.countedCredits}
          max={progress.totalCredits}
          label={`Degree progress: ${progress.countedCredits} of ${progress.totalCredits} credit hours`}
        />
        <p className="mt-3 text-sm text-muted">
          {progress.complete ? (
            <span className="font-medium text-done">All degree requirements are complete. Congratulations!</span>
          ) : (
            <>
              <span className="num font-semibold text-fg">{progress.remainingCredits}</span> credit hours to go.
              {inProgress.size > 0 && (
                <>
                  {" "}
                  <span className="inline-flex items-center gap-1 text-now">
                    <Hourglass aria-hidden className="size-3.5" />
                    {inProgressCredits} more in progress this semester.
                  </span>
                </>
              )}
            </>
          )}
        </p>

        {scale && (
          <Link
            href="/gpa"
            className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-line bg-surface-2/40 px-3.5 py-2.5 text-sm transition-colors hover:border-line-strong"
          >
            <Gauge aria-hidden className="size-4 text-accent" />
            {gpa?.cgpa != null ? (
              <>
                <span className="text-muted">CGPA</span>
                <span className="num font-semibold text-fg">{gpa.cgpa.toFixed(2)}</span>
                {gpa.rating && <Pill tone={RATING_TONE[gpa.rating] ?? "neutral"}>{gpa.rating}</Pill>}
              </>
            ) : (
              <span className="text-muted">Add your grades to see your GPA</span>
            )}
            <ArrowRight aria-hidden className="ml-auto size-4 text-dim" />
          </Link>
        )}

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="requirement-breakdown"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-strong"
        >
          <ChevronDown aria-hidden className={cn("size-4 transition-transform", open && "rotate-180")} />
          {open ? "Hide" : "See"} requirement breakdown
        </button>
        {open && (
          <ul id="requirement-breakdown" className="mt-3 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {progress.groups.map((g) => (
              <li key={g.group.id}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate text-fg">{g.group.title}</span>
                  <span className={cn("num shrink-0 text-xs", g.done ? "text-done" : "text-muted")}>
                    {g.countedCredits}/{g.requiredCredits}
                  </span>
                </div>
                <ProgressBar
                  size="sm"
                  tone={g.done ? "done" : "accent"}
                  value={g.countedCredits}
                  max={g.requiredCredits}
                  label={`${g.group.title}: ${g.countedCredits} of ${g.requiredCredits} credit hours`}
                />
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function GraduationCard() {
  const { roadmap, settings, progress } = usePlanContext();
  const semesters = roadmap.semesterCount;
  return (
    <Card aria-labelledby="grad-title" className="flex flex-col">
      <CardHeader titleId="grad-title" title="Estimated graduation" />
      <CardBody className="flex flex-1 flex-col">
        {progress.complete ? (
          <p className="text-sm text-muted">You&apos;ve met every requirement in this plan.</p>
        ) : roadmap.blocked || !roadmap.graduationTerm ? (
          <p className="flex gap-2 text-sm text-warn">
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            {roadmap.blocked?.message ?? "We couldn't build a plan with these settings."}
          </p>
        ) : (
          <>
            <p className="flex items-center gap-2.5 text-3xl font-semibold tracking-tight text-fg">
              <GraduationCap aria-hidden className="size-7 text-accent" />
              {roadmap.semesters.at(-1)!.label}
            </p>
            <p className="mt-2 text-sm text-muted">
              About <span className="font-medium text-fg">{plural(semesters, "semester")}</span> left
              {roadmap.summerCount > 0 && ` (including ${plural(roadmap.summerCount, "summer")})`}, taking up to{" "}
              {settings.maxCredits} credit hours each.
            </p>
            <p className="mt-2 text-[13px] text-dim">
              {roadmap.provablyFastest
                ? "No plan can finish sooner with these settings."
                : "Assumes the courses you need are offered when you need them."}
            </p>
          </>
        )}
        <Link
          href="/planner#roadmap"
          className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-medium text-accent hover:text-accent-strong"
        >
          See your semester-by-semester roadmap <ArrowRight aria-hidden className="size-4" />
        </Link>
      </CardBody>
    </Card>
  );
}

function NextSemesterCard({ onOpenCourse }: { onOpenCourse: (code: string) => void }) {
  const plan = usePlanContext();
  const label = usePlanItemLabel();
  const eligibleCount = [...plan.states.values()].filter(
    (s) => (s.status === "eligible" || s.status === "planned") && !s.notNeeded,
  ).length;
  const first = plan.roadmap.semesters[0];
  const items = plan.nextItems;
  const credits = items.reduce((sum, s) => sum + s.item.credits, 0);

  return (
    <Card className="lg:col-span-2" aria-labelledby="next-title">
      <CardHeader
        titleId="next-title"
        title={first && first.index === 0 ? `Next semester · ${first.label}` : "Next semester"}
        description={
          plan.progress.complete
            ? undefined
            : `${plan.isCustomized ? "Your picks" : "Suggested"} from the ${plural(eligibleCount, "course")} you can take.`
        }
      />
      <CardBody>
        {items.length === 0 ? (
          <p className="text-sm text-muted">
            {plan.progress.complete ? "Nothing left to plan." : "No courses are planned for next semester."}
          </p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {items.slice(0, 6).map(({ item, reasons }) => {
              const l = label(item);
              return (
                <li key={item.id} className="flex items-start gap-3 px-3.5 py-3">
                  <span className="num mt-0.5 w-[68px] shrink-0 text-xs text-dim">{l.code}</span>
                  <div className="min-w-0 flex-1">
                    {l.isSlot ? (
                      <p className="text-sm font-medium text-fg">{l.title}</p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onOpenCourse(l.code)}
                        className="text-left text-sm font-medium text-fg hover:text-accent"
                      >
                        {l.title}
                      </button>
                    )}
                    <p className="mt-0.5 text-[13px] text-muted">{reasons[0]}</p>
                  </div>
                  <span className="num shrink-0 text-xs text-muted">{item.credits} cr</span>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <Link href="/planner">
              Plan my next semester <ArrowRight />
            </Link>
          </Button>
          {items.length > 0 && (
            <span className="num text-sm text-muted">
              {credits} / {plan.settings.maxCredits} credit hours
            </span>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function InsightCard({ onOpenCourse }: { onOpenCourse: (code: string) => void }) {
  const { insight } = usePlanContext();
  return (
    <Card aria-labelledby="insight-title" className="flex flex-col">
      <CardHeader titleId="insight-title" title="Worth knowing" />
      <CardBody className="flex flex-1 flex-col">
        {insight ? (
          <>
            <p className="flex gap-3 text-[15px] leading-relaxed text-fg">
              <Lightbulb aria-hidden className="mt-1 size-5 shrink-0 text-warn" />
              {insight.message}
            </p>
            <button
              type="button"
              onClick={() => onOpenCourse(insight.code)}
              className="mt-auto inline-flex items-center gap-1.5 pt-4 text-left text-sm font-medium text-accent hover:text-accent-strong"
            >
              Open {insight.title} <ArrowRight aria-hidden className="size-4" />
            </button>
          </>
        ) : (
          <p className="text-sm text-muted">
            Nothing stands out right now — your next courses don&apos;t hold up anything else.
          </p>
        )}
      </CardBody>
    </Card>
  );
}

export function OverviewScreen() {
  const plan = usePlanContext();
  const [openCode, setOpenCode] = useState<string | null>(null);
  const university = getUniversity(plan.curriculum.universityId);
  const noneCompleted = plan.completed.size === 0;

  return (
    <div className="page-in mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader
        title={plan.curriculum.majorName}
        description={`${plan.curriculum.degree} · ${university?.name ?? ""}`}
      />

      {noneCompleted && (
        <div className="mt-6 flex flex-wrap items-center gap-4 rounded-2xl border border-accent/30 bg-accent-soft px-5 py-4">
          <ListChecks aria-hidden className="size-6 text-accent" />
          <p className="min-w-0 flex-1 text-sm text-fg">
            <span className="font-semibold">No completed courses yet.</span>{" "}
            <span className="text-muted">
              Mark the courses you&apos;ve already finished to see your personalized plan. New students can skip this.
            </span>
          </p>
          <Button asChild variant="secondary">
            <Link href="/courses">Mark completed courses</Link>
          </Button>
        </div>
      )}

      {plan.progress.unknownCodes.length > 0 && (
        <p role="status" className="mt-6 rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-sm text-fg">
          {plural(plan.progress.unknownCodes.length, "saved course")} ({plan.progress.unknownCodes.join(", ")}) aren&apos;t
          part of this study plan, so they aren&apos;t counted. They&apos;re still saved.
        </p>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <ProgressCard />
        <GraduationCard />
        <NextSemesterCard onOpenCourse={setOpenCode} />
        <InsightCard onOpenCourse={setOpenCode} />
      </div>

      <CourseDetailDialog code={openCode} onChange={setOpenCode} />
    </div>
  );
}
