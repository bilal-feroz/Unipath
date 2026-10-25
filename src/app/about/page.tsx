import { ArrowLeft, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
import { Pill } from "@/components/ui/pill";
import { allRegistryEntries, getUniversity } from "@/lib/curriculum/registry";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "About the data" };

function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-8 border-t border-line py-10 first:border-t-0 first:pt-0">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-muted">{children}</div>
    </section>
  );
}

export default function AboutPage() {
  const entries = allRegistryEntries();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line bg-bg-elev/80">
        <div className="mx-auto flex h-[60px] max-w-3xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <Link href="/overview" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
            <ArrowLeft aria-hidden className="size-4" /> Back to my plan
          </Link>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
        <p className="num text-[11.5px] font-semibold uppercase tracking-[0.14em] text-accent">About UniPath</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Where the data comes from, and how planning works</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-muted">{site.disclaimer}</p>

        <div className="mt-10">
          <Section title="Curriculum sources">
            <p>
              Each study plan below was transcribed by hand from publicly available Al Ain University documents and
              checked automatically: every prerequisite must point to a real course, requirement totals must add up to
              the degree total, and there can be no circular prerequisites. Only plans that pass these checks are offered.
            </p>
            <div className="space-y-4 pt-2">
              {entries.map((entry) => {
                const c = entry.curriculum;
                if (!c) return null;
                return (
                  <article key={c.id} className="rounded-2xl border border-line bg-surface p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-fg">
                        {c.degree} in {c.majorName}
                      </h3>
                      {c.verification === "official-transcribed" ? (
                        <Pill tone="done">From official study plan</Pill>
                      ) : (
                        <Pill tone="warn">Illustrative</Pill>
                      )}
                      {entry.ok ? <Pill tone="accent">Checks passed</Pill> : <Pill tone="warn">Data errors</Pill>}
                    </div>
                    <p className="mt-1 text-sm">
                      {getUniversity(c.universityId)?.name} · {c.college} · {c.totalCredits} credit hours · {c.version} · updated{" "}
                      {c.lastUpdated}
                    </p>
                    <ul className="mt-3 space-y-1 text-sm">
                      {c.sources.map((s) => (
                        <li key={s.title}>
                          {s.url ? (
                            <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:text-accent-strong">
                              {s.title} <ExternalLink aria-hidden className="size-3.5" />
                            </a>
                          ) : (
                            <span className="text-fg">{s.title}</span>
                          )}{" "}
                          <span className="text-dim">({s.kind === "study-plan" ? "courses and prerequisites" : "suggested semesters"})</span>
                        </li>
                      ))}
                    </ul>
                    {c.dataNotes.length > 0 && (
                      <details className="mt-3">
                        <summary className="cursor-pointer text-sm font-medium text-fg">
                          Data notes and interpretations ({c.dataNotes.length})
                        </summary>
                        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm">
                          {c.dataNotes.map((n) => (
                            <li key={n}>{n}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </article>
                );
              })}
            </div>
          </Section>

          <Section id="how-it-works" title="How the planner works">
            <p>
              Everything is calculated in your browser by a deterministic planning engine. No AI model decides anything
              about your courses — the same inputs always give the same plan.
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="text-fg">Eligibility:</strong> a course is available when its prerequisites are complete.
                Rules can combine courses with “and” and “or”, and some need a minimum number of completed credit hours
                (for example, the internship needs 75). A prerequisite is never assumed to count if taken in the same
                semester unless the plan says so.
              </li>
              <li>
                <strong className="text-fg">Next semester:</strong> UniPath fills your credit limit with courses you&apos;re
                eligible for, putting first the ones that start the longest chains of later courses, then the ones most
                other courses depend on, then the official suggested semester.
              </li>
              <li>
                <strong className="text-fg">Electives:</strong> UniPath never picks an elective for you. It reserves a slot
                (“Major electives — your choice”) until you choose a course.
              </li>
              <li>
                <strong className="text-fg">Graduation estimate:</strong> the roadmap repeats that process semester by
                semester. This is a heuristic, so UniPath only says a plan is the fastest possible when it can prove it:
                when the plan&apos;s length equals a lower bound set by your remaining credits and your longest prerequisite
                chain.
              </li>
              <li>
                <strong className="text-fg">What if:</strong> simulations re-run the same engine on a copy of your plan,
                so your saved progress never changes unless you press Apply.
              </li>
            </ul>
          </Section>

          <Section title="Limitations">
            <ul className="list-disc space-y-2 pl-5">
              <li>Being eligible doesn&apos;t mean a course is offered next semester or has seats. UniPath has no section data.</li>
              <li>Grades, GPA rules, transfer credit and course equivalencies aren&apos;t tracked.</li>
              <li>Department approval (for example, for capstone projects) is shown but can&apos;t be checked.</li>
              <li>Summer credit limits and maximum loads vary by university and student standing — check yours.</li>
              <li>Transcription mistakes are possible. Always confirm with your academic advisor.</li>
            </ul>
          </Section>

          <Section title="Your privacy">
            <p>
              UniPath has no accounts and no server database. Your progress is saved only in this browser&apos;s local
              storage, so it stays on this device and is lost if you clear your browser data. Use{" "}
              <strong className="text-fg">Export progress</strong> in the settings menu to keep a copy.
            </p>
          </Section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
