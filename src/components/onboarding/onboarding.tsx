"use client";

import { ArrowLeft, ArrowRight, Building2, Check, Copy, GraduationCap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { getCurriculum, majorsByCollege, universities } from "@/lib/curriculum/registry";
import type { Course, Curriculum } from "@/lib/curriculum/types";
import { useAppStore } from "@/lib/state/store";
import { cn, plural, semesterName } from "@/lib/utils";

const STEPS = ["University", "Major", "Completed courses"] as const;

function Stepper({ step }: { step: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Setup progress">
      {STEPS.map((label, i) => {
        const state = i < step ? "done" : i === step ? "current" : "todo";
        return (
          <li key={label} className="flex items-center gap-2" aria-current={state === "current" ? "step" : undefined}>
            <span
              className={cn(
                "num flex size-7 items-center justify-center rounded-full border text-xs font-semibold",
                state === "done" && "border-accent bg-accent text-accent-fg",
                state === "current" && "border-accent text-accent",
                state === "todo" && "border-line-strong text-dim",
              )}
            >
              {state === "done" ? <Check aria-hidden className="size-3.5" /> : i + 1}
            </span>
            <span className={cn("hidden text-sm sm:inline", state === "current" ? "font-medium text-fg" : "text-muted")}>
              {label}
            </span>
            {i < STEPS.length - 1 && <span aria-hidden className="mx-1 h-px w-6 bg-line-strong sm:w-10" />}
            <span className="sr-only">{state === "done" ? "(done)" : state === "current" ? "(current step)" : ""}</span>
          </li>
        );
      })}
    </ol>
  );
}

function ChoiceCard({
  selected,
  onSelect,
  title,
  subtitle,
  meta,
  icon: Icon,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  subtitle: string;
  meta?: ReactNode;
  icon: typeof Building2;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition-colors",
        selected ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-line-strong",
      )}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl border",
          selected ? "border-accent/50 text-accent" : "border-line text-muted",
        )}
      >
        <Icon aria-hidden className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-fg">{title}</span>
        <span className="mt-0.5 block text-sm text-muted">{subtitle}</span>
        {meta && <span className="mt-2 flex flex-wrap gap-1.5">{meta}</span>}
      </span>
      <span
        aria-hidden
        className={cn(
          "mt-1 flex size-5 shrink-0 items-center justify-center rounded-full border",
          selected ? "border-accent bg-accent text-accent-fg" : "border-line-strong",
        )}
      >
        {selected && <Check className="size-3" />}
      </span>
    </button>
  );
}

interface Section {
  id: string;
  title: string;
  hint?: string;
  courses: Course[];
}

/** Groups courses the way students think about them: by suggested semester, then electives and extras. */
function sectionsFor(curriculum: Curriculum): Section[] {
  const bySemester = new Map<number, Course[]>();
  const rest = new Map<string, Course[]>();
  for (const course of curriculum.courses) {
    const group = curriculum.groups.find((g) => g.id === course.groupId)!;
    if (course.recommendedSemester && group.rule === "all") {
      bySemester.set(course.recommendedSemester, [...(bySemester.get(course.recommendedSemester) ?? []), course]);
    } else {
      rest.set(group.id, [...(rest.get(group.id) ?? []), course]);
    }
  }
  const sections: Section[] = [...bySemester.entries()]
    .sort(([a], [b]) => a - b)
    .map(([n, courses]) => ({ id: `sem-${n}`, title: semesterName(n), courses }));
  for (const [groupId, courses] of rest) {
    const group = curriculum.groups.find((g) => g.id === groupId)!;
    sections.push({
      id: groupId,
      title: group.rule === "choose" ? group.title : `${group.title} (no suggested semester)`,
      hint: group.rule === "choose" ? group.description : undefined,
      courses,
    });
  }
  return sections;
}

export function Onboarding() {
  const router = useRouter();
  const personal = useAppStore((s) => s.personal);
  const { startPersonal, setCompleted } = useAppStore.getState();

  const [step, setStep] = useState(0);
  const [universityId, setUniversityId] = useState(personal?.universityId ?? universities[0].id);
  const [curriculumId, setCurriculumId] = useState<string | null>(personal?.curriculumId ?? null);
  const [query, setQuery] = useState("");
  const curriculum = getCurriculum(curriculumId);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(personal?.progress[curriculumId ?? ""]?.completed ?? []));

  // Next.js keeps hidden pages alive between navigations. Each visit to setup should start fresh,
  // so reset when this page is hidden (e.g. after finishing, or before "Switch major" brings it back).
  useLayoutEffect(
    () => () => {
      const saved = useAppStore.getState().personal;
      setStep(0);
      setQuery("");
      setUniversityId(saved?.universityId ?? universities[0].id);
      setCurriculumId(saved?.curriculumId ?? null);
      setSelected(new Set(saved?.progress[saved.curriculumId]?.completed ?? []));
    },
    [],
  );

  const colleges = useMemo(() => majorsByCollege(universityId), [universityId]);
  const sections = useMemo(() => (curriculum ? sectionsFor(curriculum) : []), [curriculum]);
  const credits = curriculum
    ? curriculum.courses.filter((c) => selected.has(c.code)).reduce((s, c) => s + c.credits, 0)
    : 0;
  const selectedCount = curriculum ? curriculum.courses.filter((c) => selected.has(c.code)).length : 0;

  // Explicit, opt-in copy from another major's saved progress (same university, identical course codes only).
  const copySources = useMemo(() => {
    if (!personal || !curriculum) return [];
    const codes = new Set(curriculum.courses.map((c) => c.code));
    return Object.entries(personal.progress)
      .filter(([id]) => id !== curriculum.id && getCurriculum(id)?.universityId === curriculum.universityId)
      .map(([id, record]) => ({
        id,
        name: getCurriculum(id)!.majorName,
        matching: record.completed.filter((c) => codes.has(c) && !selected.has(c)),
      }))
      .filter((s) => s.matching.length > 0);
  }, [personal, curriculum, selected]);

  const chooseMajor = (id: string) => {
    setCurriculumId(id);
    setSelected(new Set(personal?.progress[id]?.completed ?? []));
    setQuery("");
  };

  const toggle = (code: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  const setMany = (codes: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      codes.forEach((c) => (on ? next.add(c) : next.delete(c)));
      return next;
    });

  const finish = () => {
    if (!curriculum) return;
    startPersonal(universityId, curriculum.id);
    setCompleted(curriculum.courses.filter((c) => selected.has(c.code)).map((c) => c.code));
    toast("Your plan is ready", {
      description: "Progress is saved automatically in this browser — no account needed.",
    });
    router.push("/overview");
  };

  const q = query.trim().toLowerCase();
  const visibleSections = sections
    .map((s) => ({
      ...s,
      courses: q ? s.courses.filter((c) => c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q)) : s.courses,
    }))
    .filter((s) => s.courses.length > 0);

  return (
    <div>
      <Stepper step={step} />

      {step === 0 && (
        <section className="mt-8" aria-labelledby="uni-title">
          <h1 id="uni-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Which university are you at?
          </h1>
          <p className="mt-2 text-muted">More universities can be added as their study plans become available.</p>
          <div role="radiogroup" aria-labelledby="uni-title" className="mt-6 space-y-3">
            {universities.map((u) => (
              <ChoiceCard
                key={u.id}
                icon={Building2}
                selected={universityId === u.id}
                onSelect={() => setUniversityId(u.id)}
                title={u.name}
                subtitle={u.country}
                meta={<Pill tone="neutral">{plural(majorsByCollege(u.id).flatMap((c) => c.majors).length, "major")} available</Pill>}
              />
            ))}
          </div>
          <div className="mt-8 flex justify-end">
            <Button size="lg" onClick={() => setStep(1)}>
              Continue <ArrowRight />
            </Button>
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="mt-8" aria-labelledby="major-title">
          <h1 id="major-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
            What&apos;s your major?
          </h1>
          <p className="mt-2 text-muted">Only majors with a loaded and checked study plan are listed.</p>
          <SearchInput
            className="mt-6"
            label="Search majors"
            placeholder="Search majors…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {colleges.map((college) => {
            const majors = college.majors.filter((m) => m.majorName.toLowerCase().includes(query.trim().toLowerCase()));
            if (majors.length === 0) return null;
            return (
              <div key={college.college} className="mt-6">
                <h2 className="num text-[11px] font-semibold uppercase tracking-[0.12em] text-dim">{college.college}</h2>
                <div role="radiogroup" aria-label={college.college} className="mt-3 space-y-3">
                  {majors.map((m) => {
                    const version = m.versions[0];
                    const saved = personal?.progress[version.id]?.completed.length ?? 0;
                    return (
                      <ChoiceCard
                        key={m.majorId}
                        icon={GraduationCap}
                        selected={curriculum?.majorId === m.majorId}
                        onSelect={() => chooseMajor(version.id)}
                        title={m.majorName}
                        subtitle={`${m.degree} · ${version.totalCredits} credit hours`}
                        meta={
                          <>
                            <Pill tone="done">Official study plan</Pill>
                            {m.versions.length === 1 && <Pill>{version.version}</Pill>}
                            {saved > 0 && <Pill tone="plan">{plural(saved, "course")} saved</Pill>}
                          </>
                        }
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
          {colleges.every((c) => c.majors.every((m) => !m.majorName.toLowerCase().includes(query.trim().toLowerCase()))) && (
            <p className="mt-6 text-sm text-muted">No majors match “{query}”.</p>
          )}
          {curriculum && (
            <p className="mt-4 text-[13px] text-muted">
              Study plan: <span className="text-fg">{curriculum.version}</span> — the only version available, so it&apos;s
              selected for you.
            </p>
          )}
          <div className="mt-8 flex justify-between gap-3">
            <Button variant="ghost" size="lg" onClick={() => setStep(0)}>
              <ArrowLeft /> Back
            </Button>
            <Button size="lg" disabled={!curriculum} onClick={() => setStep(2)}>
              Continue <ArrowRight />
            </Button>
          </div>
        </section>
      )}

      {step === 2 && curriculum && (
        <section className="mt-8" aria-labelledby="courses-title">
          <h1 id="courses-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Which courses have you finished?
          </h1>
          <p className="mt-2 text-muted">
            Tick everything you&apos;ve passed in {curriculum.majorName}. New students can skip this — just press{" "}
            <span className="text-fg">See my plan</span>.
          </p>

          {copySources.map((source) => (
            <div key={source.id} className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-plan/30 bg-plan-soft px-4 py-3">
              <Copy aria-hidden className="size-4 text-plan" />
              <p className="min-w-0 flex-1 text-sm">
                {plural(source.matching.length, "course")} you marked in {source.name} have the same course code here.
              </p>
              <Button variant="secondary" size="sm" onClick={() => setMany(source.matching, true)}>
                Copy them
              </Button>
            </div>
          ))}

          <SearchInput
            className="mt-6"
            label="Search courses"
            placeholder="Search by course name or code…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <div className="mt-6 space-y-6">
            {visibleSections.map((section) => {
              const codes = section.courses.map((c) => c.code);
              const allOn = codes.every((c) => selected.has(c));
              return (
                <fieldset key={section.id} className="rounded-2xl border border-line bg-surface">
                  <legend className="sr-only">{section.title}</legend>
                  <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
                    <div>
                      <p className="font-semibold text-fg">{section.title}</p>
                      {section.hint && <p className="text-[13px] text-muted">{section.hint}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => setMany(codes, !allOn)}
                      className="shrink-0 text-sm font-medium text-accent hover:text-accent-strong"
                    >
                      {allOn ? "Clear" : "Select all"}
                      <span className="sr-only"> in {section.title}</span>
                    </button>
                  </div>
                  <ul className="divide-y divide-line">
                    {section.courses.map((c) => (
                      <li key={c.code}>
                        <label className="flex min-h-12 cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-surface-2/50">
                          <input
                            type="checkbox"
                            checked={selected.has(c.code)}
                            onChange={() => toggle(c.code)}
                            className="size-[18px] shrink-0 accent-[var(--accent)]"
                          />
                          <span className="num w-[72px] shrink-0 text-xs text-dim">{c.code}</span>
                          <span className="min-w-0 flex-1 text-sm text-fg">{c.title}</span>
                          <span className="num shrink-0 text-xs text-muted">{c.credits} cr</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </fieldset>
              );
            })}
            {visibleSections.length === 0 && <p className="text-sm text-muted">No courses match “{query}”.</p>}
          </div>

          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg-elev/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
            <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
              <Button variant="ghost" onClick={() => setStep(1)}>
                <ArrowLeft /> <span className="hidden sm:inline">Back</span>
              </Button>
              <p className="text-sm text-muted" aria-live="polite">
                <span className="num font-semibold text-fg">{selectedCount}</span> courses ·{" "}
                <span className="num font-semibold text-fg">{credits}</span> credit hours
              </p>
              <Button size="lg" onClick={finish}>
                See my plan <ArrowRight />
              </Button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
