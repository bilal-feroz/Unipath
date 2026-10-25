import { ArrowLeft, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
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
      <header className="glass-bar sticky top-0 z-40 border-b border-line">
        <div className="mx-auto flex h-[60px] max-w-3xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <div className="flex items-center gap-3">
            <Link href="/overview" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
              <ArrowLeft aria-hidden className="size-4" /> Back to my plan
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
        <p className="text-[13.5px] font-medium text-accent">About UniPath</p>
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
                  <article key={c.id} className="glass rounded-2xl border border-line p-5">
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
              Everything about your courses is calculated in your browser by a deterministic planning engine. No AI model
              decides anything about eligibility, plans or graduation — the same inputs always give the same plan.
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
              <li>
                <strong className="text-fg">Taking now:</strong> courses you mark as taking this semester aren&apos;t counted
                as completed, but next semester is planned as if you pass them.
              </li>
              <li>
                <strong className="text-fg">GPA:</strong> your CGPA uses Al Ain University&apos;s official undergraduate grade
                points (A = 4.0 down to D = 1.0) and rating bands, weighted by credit hours. Pass and Transfer grades aren&apos;t
                counted.
              </li>
            </ul>
          </Section>

          <Section id="ai-coach" title="How the AI coach works">
            <p>
              AI is used in two places only: the AI Coach, which suggests portfolio projects and answers questions about
              them, and the optional AI reader for importing deadlines from a course outline. Neither ever changes your
              plan, your course rules, your GPA, your attendance or the conflict checks — those are all plain calculations.
            </p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                It uses a free AI API with live web search, so it can look up current industry practice: Groq&apos;s{" "}
                <strong className="text-fg">gpt-oss-120b</strong> or Google&apos;s <strong className="text-fg">Gemini 2.5 Flash</strong>,
                depending on how the site is set up. The coach page names the one in use, and its answers list the web
                sources it found (or say so when it couldn&apos;t search).
              </li>
              <li>
                Only course codes go from your browser to UniPath&apos;s server; the server looks up the course names, so the AI
                only ever sees real courses from your study plan, and any course it mentions that you haven&apos;t taken is
                removed.
              </li>
              <li>AI suggestions can be wrong or out of date. Treat them as ideas to explore, not advice.</li>
            </ul>
          </Section>

          <Section title="Limitations">
            <ul className="list-disc space-y-2 pl-5">
              <li>Being eligible doesn&apos;t mean a course is offered next semester or has seats. UniPath has no section data.</li>
              <li>
                The GPA only includes courses you&apos;ve passed. Failed attempts and repeated courses also count in your
                official CGPA. Academic warning and probation rules aren&apos;t modelled.
              </li>
              <li>Transfer credit and course equivalencies aren&apos;t tracked.</li>
              <li>Department approval (for example, for capstone projects) is shown but can&apos;t be checked.</li>
              <li>Summer credit limits and maximum loads vary by university and student standing — check yours.</li>
              <li>Transcription mistakes are possible. Always confirm with your academic advisor.</li>
            </ul>
          </Section>

          <Section title="Your privacy">
            <p>
              UniPath has no accounts and no server database. Your progress, grades, timetable, deadlines, events and
              attendance are saved only in this browser&apos;s local storage, so they stay on this device and are lost if you
              clear your browser data. Use <strong className="text-fg">Export progress</strong> in the settings menu to keep a
              copy — it includes everything. There&apos;s no cloud sync between devices.
            </p>
            <p>
              Two exceptions, and only when you press a button: the <strong className="text-fg">AI Coach</strong> sends your
              major, the course codes you&apos;ve completed or are taking, and anything you type (interests, questions); the{" "}
              <strong className="text-fg">AI deadline reader</strong> sends the text you import (a PDF is turned into text in
              your browser first). Both go to the AI provider named on the page (Groq or Google Gemini). Your grades,
              attendance, name and saved file are never sent, and the offline deadline reader sends nothing. Groq says it
              doesn&apos;t use API requests to train models; on Gemini&apos;s free tier, Google may use requests to improve its
              products.
            </p>
            <p>
              Reminders appear while UniPath is open in a tab. There&apos;s no server that could notify you when the browser is
              closed, and UniPath isn&apos;t connected to any university system: timetables and deadlines are what you enter
              or import.
            </p>
          </Section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
