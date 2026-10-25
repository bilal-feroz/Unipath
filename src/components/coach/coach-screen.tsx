"use client";

import {
  ArrowUp,
  BookOpen,
  Clock,
  ExternalLink,
  Footprints,
  Hourglass,
  Info,
  Lightbulb,
  MessageSquare,
  RefreshCw,
  Rocket,
  Sparkles,
  TrendingUp,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { PageHeader } from "@/components/app-shell/app-shell";
import { usePlanContext } from "@/components/app-shell/plan-context";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Pill, type PillTone } from "@/components/ui/pill";
import type { CoachError, CoachSource, Difficulty, ProjectIdea } from "@/lib/coach/schema";
import { cn, plural } from "@/lib/utils";
import { RichText } from "./rich-text";
import { ThisSemesterDialog } from "./this-semester-dialog";
import { useCoach } from "./use-coach";

const DIFFICULTY: Record<Difficulty, { label: string; tone: PillTone }> = {
  beginner: { label: "Beginner", tone: "done" },
  intermediate: { label: "Intermediate", tone: "open" },
  advanced: { label: "Advanced", tone: "plan" },
};

function Chips({ items, tone = "neutral" }: { items: string[]; tone?: PillTone }) {
  if (items.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((s) => (
        <li key={s}>
          <Pill tone={tone} className="h-auto min-h-[22px] whitespace-normal py-0.5 normal-case tracking-normal">
            {s}
          </Pill>
        </li>
      ))}
    </ul>
  );
}

function Sources({ sources }: { sources: CoachSource[] }) {
  if (sources.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
      {sources.map((s) => (
        <li key={s.url}>
          <a
            href={s.url}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 text-[13px] text-accent hover:text-accent-strong"
          >
            {s.title} <ExternalLink aria-hidden className="size-3" />
          </a>
        </li>
      ))}
    </ul>
  );
}

function IdeaCard({ idea, onAsk }: { idea: ProjectIdea; onAsk: (q: string) => void }) {
  const plan = usePlanContext();
  const d = DIFFICULTY[idea.difficulty];
  return (
    <Card className="flex flex-col" data-testid="idea-card">
      <CardBody className="flex flex-1 flex-col gap-4 pt-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={d.tone}>{d.label}</Pill>
            {idea.timeEstimate && (
              <span className="inline-flex items-center gap-1 text-[12.5px] text-muted">
                <Clock aria-hidden className="size-3.5" /> {idea.timeEstimate}
              </span>
            )}
          </div>
          <h3 className="mt-2.5 text-lg font-semibold tracking-tight text-fg">{idea.title}</h3>
          {idea.summary && <p className="mt-1 text-sm leading-relaxed text-muted">{idea.summary}</p>}
        </div>

        {idea.whyItFits && (
          <div>
            <p className="num mb-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-dim">Why it fits you</p>
            <p className="text-sm text-fg">{idea.whyItFits}</p>
          </div>
        )}
        {idea.buildsOn.length > 0 && (
          <div>
            <p className="num mb-1.5 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-dim">
              <BookOpen aria-hidden className="size-3" /> Builds on
            </p>
            <Chips items={idea.buildsOn.map((c) => plan.index.byCode.get(c)?.title ?? c)} tone="done" />
          </div>
        )}
        {idea.industryPractices.length > 0 && (
          <div>
            <p className="num mb-1.5 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-dim">
              <TrendingUp aria-hidden className="size-3" /> Industry practices you&apos;ll show
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-fg">
              {idea.industryPractices.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}
        {(idea.stack.length > 0 || idea.skills.length > 0) && (
          <div>
            <p className="num mb-1.5 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-dim">
              <Wrench aria-hidden className="size-3" /> Tools and skills
            </p>
            <Chips items={[...new Set([...idea.stack, ...idea.skills])]} tone="accent" />
          </div>
        )}
        {idea.firstSteps.length > 0 && (
          <div>
            <p className="num mb-1.5 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-dim">
              <Footprints aria-hidden className="size-3" /> First steps
            </p>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-fg">
              {idea.firstSteps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </div>
        )}
        <div className="mt-auto pt-1">
          <Button variant="secondary" size="sm" onClick={() => onAsk(`How should I start "${idea.title}"?`)}>
            <MessageSquare /> Ask about this idea
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function ErrorPanel({ error }: { error: CoachError }) {
  const notSetUp = error.error === "not_configured";
  return (
    <div role="alert" className="flex gap-3 rounded-2xl border border-warn/35 bg-warn-soft p-4 text-sm">
      <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warn" />
      <div>
        <p className="font-semibold text-fg">{notSetUp ? "The AI coach isn't switched on yet" : "The coach couldn't answer"}</p>
        <p className="mt-0.5 text-muted">
          {notSetUp
            ? "This site needs a free Google Gemini API key on its server before the coach can work. Everything else in UniPath works without it."
            : error.message}
        </p>
      </div>
    </div>
  );
}

function LoadingIdeas() {
  return (
    <div aria-busy="true" aria-live="polite">
      <p className="flex items-center gap-2 text-sm text-muted">
        <Sparkles aria-hidden className="size-4 animate-pulse text-accent" />
        Searching current industry sources and matching them to your courses…
      </p>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="glass h-72 animate-pulse rounded-2xl border border-line" />
        ))}
      </div>
    </div>
  );
}

export function CoachScreen() {
  const plan = usePlanContext();
  const coach = useCoach();
  const [interests, setInterests] = useState("");
  const [question, setQuestion] = useState("");
  const inProgress = [...plan.inProgress].map((c) => plan.index.byCode.get(c)!);

  const submitQuestion = async (e?: FormEvent, text = question) => {
    e?.preventDefault();
    const q = text.trim();
    if (!q || coach.loading) return;
    setQuestion("");
    const ok = await coach.ask(q);
    if (!ok) setQuestion(q);
  };

  return (
    <div className="page-in mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow="06 · AI Coach"
        title="Project ideas for you"
        description="Portfolio projects that build on your courses and on what employers expect right now. Powered by Google Gemini with live web search."
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
        <div className="space-y-4">
          <Card aria-labelledby="start-title">
            <CardHeader titleId="start-title" eyebrow="Your starting point" title="What the coach will look at" />
            <CardBody className="space-y-5">
              <div>
                <p className="text-sm text-fg">
                  <span className="num font-semibold">{plan.completed.size}</span> completed{" "}
                  {plan.completed.size === 1 ? "course" : "courses"}
                </p>
                <Link href="/courses" className="text-[13px] text-accent hover:text-accent-strong">
                  Update in My Courses →
                </Link>
              </div>

              <div>
                <p className="flex items-center gap-1.5 text-sm font-medium text-fg">
                  <Hourglass aria-hidden className="size-4 text-now" /> Taking this semester
                </p>
                {inProgress.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {inProgress.map((c) => (
                      <li key={c.code} className="text-sm text-muted">
                        {c.title}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-[13px] text-muted">None marked yet.</p>
                )}
                <ThisSemesterDialog
                  trigger={
                    <Button variant="secondary" size="sm" className="mt-2.5">
                      {inProgress.length > 0 ? "Change this semester's courses" : "Add this semester's courses"}
                    </Button>
                  }
                />
              </div>

              <div>
                <label htmlFor="interests" className="text-sm font-medium text-fg">
                  What are you into? <span className="font-normal text-dim">(optional)</span>
                </label>
                <input
                  id="interests"
                  value={interests}
                  onChange={(e) => setInterests(e.target.value)}
                  maxLength={200}
                  placeholder="e.g. web apps, AI, games, security"
                  className="mt-2 h-10 w-full rounded-[10px] border border-line bg-bg/60 px-3 text-sm text-fg placeholder:text-dim hover:border-line-strong focus:border-accent focus:outline-none"
                />
              </div>

              <Button size="lg" className="w-full" onClick={() => coach.getIdeas(interests)} disabled={coach.loading !== null}>
                {coach.ideas ? <RefreshCw /> : <Sparkles />}
                {coach.loading === "ideas" ? "Thinking…" : coach.ideas ? "Get new ideas" : "Get project ideas"}
              </Button>

              <p className="flex gap-2 text-[12px] leading-relaxed text-dim">
                <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                Sends your major, course names and interests to Google Gemini — nothing else, and no name. On
                Gemini&apos;s free tier, Google may use requests to improve its products.
              </p>
            </CardBody>
          </Card>
        </div>

        <section aria-labelledby="ideas-title" className="min-w-0 space-y-4">
          <h2 id="ideas-title" className="sr-only">
            Project ideas
          </h2>
          {coach.error && <ErrorPanel error={coach.error} />}

          {coach.loading === "ideas" ? (
            <LoadingIdeas />
          ) : coach.ideas ? (
            <>
              {coach.stale && (
                <p role="status" className="rounded-xl border border-line-strong bg-surface-2/50 px-4 py-2.5 text-sm text-muted">
                  Your courses changed since these ideas were made. Press <span className="text-fg">Get new ideas</span> to
                  refresh them.
                </p>
              )}
              {coach.ideas.trends && (
                <Card aria-labelledby="trends-title">
                  <CardHeader titleId="trends-title" eyebrow="Right now" title="What employers expect" />
                  <CardBody>
                    <p className="flex gap-3 text-[15px] leading-relaxed text-fg">
                      <Lightbulb aria-hidden className="mt-1 size-5 shrink-0 text-warn" />
                      {coach.ideas.trends}
                    </p>
                    {coach.ideas.sources.length > 0 && (
                      <div className="mt-4">
                        <p className="num text-[10.5px] font-semibold uppercase tracking-[0.12em] text-dim">
                          Found with Google Search
                        </p>
                        <Sources sources={coach.ideas.sources} />
                      </div>
                    )}
                  </CardBody>
                </Card>
              )}
              <div className="grid gap-4 xl:grid-cols-2">
                {coach.ideas.ideas.map((idea) => (
                  <IdeaCard key={idea.title} idea={idea} onAsk={(q) => submitQuestion(undefined, q)} />
                ))}
              </div>
              <p className="text-[12px] text-dim">
                Generated {new Date(coach.ideas.generatedAt).toLocaleString()} with {coach.ideas.model}. AI suggestions can be
                wrong — check anything important. UniPath&apos;s course planning never comes from AI.
              </p>

              <Card aria-labelledby="chat-title">
                <CardHeader
                  titleId="chat-title"
                  eyebrow="Follow-up"
                  title="Ask the coach"
                  description="Questions about these projects, tools or skills."
                />
                <CardBody>
                  {coach.chat.length > 0 && (
                    <ol className="mb-4 space-y-3" aria-live="polite">
                      {coach.chat.map((m, i) => (
                        <li key={i} className={cn("flex", m.role === "student" ? "justify-end" : "justify-start")}>
                          <div
                            className={cn(
                              "max-w-[88%] rounded-2xl px-4 py-2.5 text-sm",
                              m.role === "student" ? "bg-accent text-accent-fg" : "border border-line bg-surface-2/50 text-fg",
                            )}
                          >
                            <span className="sr-only">{m.role === "student" ? "You: " : "Coach: "}</span>
                            {m.role === "coach" ? <RichText text={m.text} /> : m.text}
                            {m.sources && <Sources sources={m.sources.slice(0, 4)} />}
                          </div>
                        </li>
                      ))}
                      {coach.loading === "ask" && (
                        <li className="flex items-center gap-2 text-sm text-muted">
                          <Sparkles aria-hidden className="size-4 animate-pulse text-accent" /> Thinking…
                        </li>
                      )}
                    </ol>
                  )}
                  <form onSubmit={submitQuestion} className="flex gap-2">
                    <label htmlFor="coach-question" className="sr-only">
                      Your question
                    </label>
                    <input
                      id="coach-question"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      maxLength={500}
                      placeholder="e.g. Which idea would impress employers most?"
                      className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-bg/60 px-3.5 text-sm text-fg placeholder:text-dim hover:border-line-strong focus:border-accent focus:outline-none"
                    />
                    <Button type="submit" size="icon" className="size-11" disabled={!question.trim() || coach.loading !== null} aria-label="Send question">
                      <ArrowUp />
                    </Button>
                  </form>
                </CardBody>
              </Card>
            </>
          ) : (
            !coach.error && (
              <div className="glass flex min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong px-6 py-12 text-center">
                <Rocket aria-hidden className="size-9 text-accent" />
                <p className="mt-4 text-lg font-semibold text-fg">Turn your courses into a portfolio</p>
                <p className="mt-1.5 max-w-md text-sm text-muted">
                  The coach looks at the {plural(plan.completed.size, "course")} you&apos;ve finished
                  {plan.inProgress.size > 0 ? ` and ${plan.inProgress.size} you're taking now` : ""}, checks what the industry
                  wants today, and suggests projects you could start this month.
                </p>
              </div>
            )
          )}
        </section>
      </div>
    </div>
  );
}
