"use client";

import { Info, RotateCcw, TriangleAlert, X } from "lucide-react";
import { usePlanContext } from "@/components/app-shell/plan-context";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Segmented } from "@/components/ui/segmented";
import { isSatisfied } from "@/lib/curriculum/prereq";
import { courseName, prereqContext, type PlanItem } from "@/lib/engine";
import { useAppStore } from "@/lib/state/store";
import { cn } from "@/lib/utils";
import { AddCourseDialog } from "./add-course-dialog";
import { KeyCourses } from "./key-courses";
import { usePlanItemLabel } from "./plan-item-label";
import { LOAD_OPTIONS } from "./planning-settings";
import { usePlanActions } from "./use-plan-actions";

function SlotPicker({ item }: { item: Extract<PlanItem, { kind: "slot" }> }) {
  const plan = usePlanContext();
  const actions = usePlanActions();
  const group = plan.index.groupById.get(item.groupId)!;
  const ctx = prereqContext(plan.index, plan.completed);
  const options = group.courses.filter((code) => {
    if (plan.completed.has(code) || actions.currentIds.includes(code)) return false;
    return isSatisfied(plan.index.byCode.get(code)!.prerequisite, ctx);
  });
  return (
    <Select
      label={`Choose a course for ${group.title}`}
      value=""
      onChange={(e) => e.target.value && actions.pickForSlot(item.id, e.target.value)}
      className="mt-2 h-9 w-full max-w-sm text-[13px]"
    >
      <option value="">Choose a course… (or decide later)</option>
      {options.map((code) => (
        <option key={code} value={code}>
          {courseName(plan.index, code)}
        </option>
      ))}
    </Select>
  );
}

export function NextSemester({ onOpenCourse }: { onOpenCourse: (code: string) => void }) {
  const plan = usePlanContext();
  const actions = usePlanActions();
  const label = usePlanItemLabel();
  const setPreferences = useAppStore((s) => s.setPreferences);
  const first = plan.roadmap.semesters[0];
  const termName = first && first.index === 0 ? first.label : plan.recommended.semesters[0]?.label ?? "Next semester";
  const credits = actions.currentCredits;
  const over = credits > actions.maxCredits;

  if (plan.progress.complete) {
    return (
      <Card>
        <CardBody className="pt-5">
          <p className="font-medium text-done">Every requirement is complete — there&apos;s nothing left to plan.</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card aria-labelledby="next-sem-title">
          <CardHeader
            titleId="next-sem-title"
            eyebrow={termName}
            title={plan.isCustomized ? "Your next semester" : "Recommended next semester"}
            description={
              plan.isCustomized
                ? "You've adjusted this plan. UniPath plans everything after it around your choices."
                : "Chosen to keep you on track: courses that hold up the most later courses come first."
            }
            action={plan.isCustomized ? <Pill tone="plan">Customized</Pill> : <Pill tone="accent">Recommended</Pill>}
          />
          <CardBody>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <p className="num text-sm text-muted" aria-live="polite">
                <span className={cn("text-xl font-semibold", over ? "text-warn" : "text-fg")}>{credits}</span> /{" "}
                {actions.maxCredits} credit hours
              </p>
              <ProgressBar
                className="max-w-xs flex-1"
                value={credits}
                max={actions.maxCredits}
                tone="plan"
                label={`Planned credit hours: ${credits} of ${actions.maxCredits}`}
              />
            </div>
            {over && (
              <p className="mt-2 text-[13px] text-warn">
                This is above your limit of {actions.maxCredits}. Remove a course or raise your limit.
              </p>
            )}

            {plan.customDelay && (
              <div role="alert" className="mt-4 flex gap-3 rounded-xl border border-warn/35 bg-warn-soft p-3.5">
                <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warn" />
                <div className="text-sm">
                  <p className="font-semibold text-fg">
                    This plan may delay graduation: {plan.customDelay.from} → {plan.customDelay.to}
                  </p>
                  <p className="mt-0.5 text-muted">{plan.customDelay.reason}</p>
                </div>
              </div>
            )}

            {plan.roadmap.firstSemesterIssues.length > 0 && (
              <div role="status" className="mt-4 rounded-xl border border-line-strong bg-surface-2/50 p-3.5 text-sm">
                <p className="font-medium text-fg">Left out of your plan:</p>
                <ul className="mt-1 list-disc pl-5 text-muted">
                  {plan.roadmap.firstSemesterIssues.map((i) => (
                    <li key={i.id}>{i.message}</li>
                  ))}
                </ul>
              </div>
            )}

            {plan.nextItems.length === 0 ? (
              <p className="mt-5 rounded-xl border border-dashed border-line-strong px-4 py-8 text-center text-sm text-muted">
                No courses planned for {termName}. Add a course, or reset to the recommendation.
              </p>
            ) : (
              <ul className="mt-5 space-y-2.5" aria-label={`Courses planned for ${termName}`}>
                {plan.nextItems.map(({ item, reasons }) => {
                  const l = label(item);
                  return (
                    <li key={item.id} className="rounded-xl border border-line bg-bg/40 p-3.5" data-testid={`planned-${item.id}`}>
                      <div className="flex items-start gap-3">
                        <span className="num mt-0.5 w-[70px] shrink-0 text-xs text-dim">{l.code}</span>
                        <div className="min-w-0 flex-1">
                          {l.isSlot ? (
                            <p className="text-sm font-semibold text-fg">{l.title}</p>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onOpenCourse(l.code)}
                              className="text-left text-sm font-semibold text-fg hover:text-accent"
                            >
                              {l.title}
                            </button>
                          )}
                          <ul className="mt-1 space-y-0.5">
                            {reasons.map((r) => (
                              <li key={r} className="text-[13px] text-muted">
                                <span className="sr-only">Why: </span>
                                {r}
                              </li>
                            ))}
                          </ul>
                          {item.kind === "slot" && <SlotPicker item={item} />}
                        </div>
                        <span className="num shrink-0 text-xs text-muted">{item.credits} cr</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="-my-1.5 size-9"
                          onClick={() => actions.remove(item.id)}
                          aria-label={`Remove ${l.title} from next semester`}
                        >
                          <X />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              <AddCourseDialog />
              {plan.isCustomized && (
                <Button variant="ghost" onClick={actions.resetToRecommended}>
                  <RotateCcw /> Reset to recommended
                </Button>
              )}
            </div>
          </CardBody>
        </Card>

        <p className="flex gap-2.5 px-1 text-[13px] text-muted">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-dim" />
          Eligible doesn&apos;t mean offered. UniPath checks prerequisites, not which sections your university opens or
          how many seats are left — confirm in your registration system and with your advisor.
        </p>
      </div>

      <div className="space-y-4">
        <Card aria-labelledby="load-title">
          <CardHeader
            titleId="load-title"
            eyebrow="Workload"
            title="Credit hours per semester"
            description="Changing this recalculates your whole plan."
          />
          <CardBody>
            <Segmented
              label="Credit hours per semester"
              value={plan.settings.maxCredits}
              onChange={(v) => setPreferences({ maxCredits: v })}
              options={LOAD_OPTIONS}
            />
          </CardBody>
        </Card>
        <KeyCourses onOpenCourse={onOpenCourse} />
      </div>
    </div>
  );
}
