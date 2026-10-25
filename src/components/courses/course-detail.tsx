"use client";

import { CalendarMinus, CalendarPlus, Check, CircleCheck, CircleX, Hourglass, Info, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import { usePlanContext } from "@/components/app-shell/plan-context";
import { usePlanActions } from "@/components/planner/use-plan-actions";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { checkPrereq, type PrereqCheck } from "@/lib/curriculum/prereq";
import { courseImpact, prereqContext, unlockedBy } from "@/lib/engine";
import { cn, plural, semesterName } from "@/lib/utils";
import { STATUS_META, StatusBadge } from "./status-badge";
import { useCourseActions } from "./use-course-actions";

function CourseLink({ code, onSelect }: { code: string; onSelect?: (code: string) => void }) {
  const plan = usePlanContext();
  const title = plan.index.byCode.get(code)?.title ?? code;
  if (!onSelect) return <span>{title}</span>;
  return (
    <button
      type="button"
      onClick={() => onSelect(code)}
      className="text-left text-fg underline decoration-line-strong underline-offset-4 hover:decoration-accent"
    >
      {title}
    </button>
  );
}

function CheckRow({ met, children, neutral }: { met: boolean; children: ReactNode; neutral?: boolean }) {
  const Icon = neutral ? Info : met ? CircleCheck : CircleX;
  return (
    <li className="flex items-start gap-2.5 py-1">
      <Icon
        aria-hidden
        className={cn("mt-0.5 size-4 shrink-0", neutral ? "text-warn" : met ? "text-done" : "text-lock")}
      />
      <span className="min-w-0 text-sm">
        <span className="sr-only">{neutral ? "Note: " : met ? "Done: " : "Still needed: "}</span>
        {children}
      </span>
    </li>
  );
}

function PrereqTree({ check, onSelect }: { check: PrereqCheck; onSelect?: (code: string) => void }) {
  switch (check.kind) {
    case "course":
      return (
        <CheckRow met={check.met}>
          <CourseLink code={check.code} onSelect={onSelect} /> <span className="num text-xs text-dim">{check.code}</span>
          {check.minGrade && <span className="text-muted"> — grade {check.minGrade} or better</span>}
        </CheckRow>
      );
    case "credits":
      return (
        <CheckRow met={check.met}>
          At least {check.min} completed credit hours{" "}
          <span className="text-muted">(you have {check.have})</span>
        </CheckRow>
      );
    case "note":
      return (
        <CheckRow met neutral>
          {check.text} <span className="text-muted">— UniPath can&apos;t check this.</span>
        </CheckRow>
      );
    case "all":
      return (
        <>
          {check.items.map((item, i) => (
            <PrereqTree key={i} check={item} onSelect={onSelect} />
          ))}
        </>
      );
    case "any":
      return (
        <li className="py-1">
          <p className="flex items-center gap-2 text-sm text-muted">
            {check.met ? <Check className="size-4 text-done" aria-hidden /> : null}
            Any one of:
          </p>
          <ul className="ml-3 border-l border-line pl-3">
            {check.items.map((item, i) => (
              <PrereqTree key={i} check={item} onSelect={onSelect} />
            ))}
          </ul>
        </li>
      );
  }
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line py-4 first:border-t-0 first:pt-0">
      <h3 className="mb-2 text-[12.5px] font-medium text-muted">{title}</h3>
      {children}
    </section>
  );
}

/** Everything a student needs to know about one course, plus the actions they can take on it. */
export function CourseDetail({ code, onSelectCourse }: { code: string; onSelectCourse?: (code: string) => void }) {
  const plan = usePlanContext();
  const { toggle, toggleNow } = useCourseActions();
  const actions = usePlanActions();
  const course = plan.index.byCode.get(code);
  const state = plan.states.get(code);
  if (!course || !state) return <p className="text-sm text-muted">This course isn&apos;t part of your plan.</p>;

  const group = plan.index.groupById.get(course.groupId)!;
  const ctx = prereqContext(plan.index, plan.assumedDone);
  const check = course.prerequisite ? checkPrereq(course.prerequisite, ctx) : null;
  const unlocks = state.status === "completed" || state.status === "inprogress" ? [] : unlockedBy(plan.index, plan.assumedDone, code);
  const impact = courseImpact(plan.index, plan.assumedDone, code, plan.record.electiveChoices);
  const meta = STATUS_META[state.status];
  const planned = actions.currentIds.includes(code);
  const addCheck = actions.canAdd(code);

  let statusText = meta.description;
  if (state.status === "eligible" && state.notNeeded) statusText = `Optional — your ${group.title} is already complete.`;
  if (state.status === "locked") statusText = "Complete the courses marked below first.";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Pill>{course.code}</Pill>
        <Pill tone="neutral">{plural(course.credits, "credit hour")}</Pill>
        <StatusBadge status={state.status} />
      </div>
      <p className={cn("mt-3 text-sm", meta.text)}>{statusText}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant={state.status === "completed" ? "secondary" : "primary"} onClick={() => toggle(code)}>
          {state.status === "completed" ? <RotateCcw /> : <Check />}
          {state.status === "completed" ? "Mark as not completed" : "Mark as completed"}
        </Button>
        {state.status !== "completed" && (
          <Button variant="secondary" onClick={() => toggleNow(code)} aria-pressed={state.status === "inprogress"}>
            <Hourglass /> {state.status === "inprogress" ? "Not taking it this semester" : "I'm taking it this semester"}
          </Button>
        )}
        {state.status !== "completed" &&
          state.status !== "inprogress" &&
          (planned ? (
            <Button variant="secondary" onClick={() => actions.remove(code)}>
              <CalendarMinus /> Remove from next semester
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => actions.add(code)} aria-describedby={addCheck.ok ? undefined : `why-${code}`}>
              <CalendarPlus /> Add to next semester
            </Button>
          ))}
      </div>
      {!addCheck.ok && state.status !== "completed" && state.status !== "inprogress" && !planned && (
        <p id={`why-${code}`} className="mt-2 text-[13px] text-muted">
          {addCheck.title}. {addCheck.description}
        </p>
      )}

      <div className="mt-5">
        <Section title="Courses you need first">
          {check ? (
            <ul>
              <PrereqTree check={check} onSelect={onSelectCourse} />
            </ul>
          ) : (
            <p className="text-sm text-muted">None — you can take this course any time.</p>
          )}
          {course.corequisites.length > 0 && (
            <p className="mt-2 text-sm text-muted">
              Take at the same time (or earlier):{" "}
              {course.corequisites.map((c, i) => (
                <span key={c}>
                  {i > 0 && ", "}
                  <CourseLink code={c} onSelect={onSelectCourse} />
                </span>
              ))}
            </p>
          )}
          {course.officialPrerequisiteText && (
            <p className="mt-2 text-[13px] text-dim">
              Official plan lists: <span className="num">{course.officialPrerequisiteText}</span>
            </p>
          )}
        </Section>

        <Section title="What it opens up">
          {unlocks.length > 0 ? (
            <>
              <p className="mb-1 text-sm text-muted">Finishing it makes these available right away:</p>
              <ul className="space-y-1">
                {unlocks.map((c) => (
                  <li key={c} className="text-sm">
                    <CourseLink code={c} onSelect={onSelectCourse} />
                  </li>
                ))}
              </ul>
            </>
          ) : impact.downstream.length > 0 && state.status !== "completed" ? (
            <p className="text-sm text-muted">It&apos;s one of the courses needed before later ones (see below).</p>
          ) : (
            <p className="text-sm text-muted">
              {state.status === "completed" ? "Already counted in your progress." : "No other course needs this one directly."}
            </p>
          )}
          {impact.downstream.length > 0 && state.status !== "completed" && (
            <p className="mt-2 text-sm text-muted">
              {plural(impact.downstream.length, "later course")} in your plan depend on it
              {impact.chainLength >= 3 ? `, in a chain up to ${impact.chainLength} courses long` : ""}.
            </p>
          )}
        </Section>

        <Section title="Counts toward">
          <p className="text-sm font-medium text-fg">{group.title}</p>
          <p className="text-sm text-muted">{group.description}</p>
          {course.recommendedSemester && (
            <p className="mt-2 text-sm text-muted">
              Suggested in the official plan for <span className="text-fg">{semesterName(course.recommendedSemester)}</span>.
            </p>
          )}
        </Section>

        {course.notes.length > 0 && (
          <Section title="Data note">
            {course.notes.map((n) => (
              <p key={n} className="text-[13px] text-muted">
                {n}
              </p>
            ))}
          </Section>
        )}
      </div>
    </div>
  );
}
