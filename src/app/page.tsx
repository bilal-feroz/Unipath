import {
  ArrowRight,
  CalendarRange,
  FlaskConical,
  Gauge,
  LayoutDashboard,
  ListChecks,
  Lock,
  MousePointerClick,
  ShieldCheck,
  Sparkles,
  Waypoints,
} from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { BrowserOnly } from "@/components/browser-only";
import { ContinueLink } from "@/components/landing/continue-link";
import { LivePreview } from "@/components/landing/live-preview";
import { Logo } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonClass } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: LayoutDashboard,
    title: "Overview",
    body: "Credits done, credits to go, an estimated graduation term and what to take next — at a glance.",
  },
  {
    icon: ListChecks,
    title: "My Courses",
    body: "Every course is Completed, Planned, Available or Locked, and locked ones tell you exactly why.",
  },
  {
    icon: CalendarRange,
    title: "Semester Planner",
    body: "A recommended next semester where every course explains why it was chosen.",
  },
  {
    icon: FlaskConical,
    title: "What if?",
    body: "Try a lighter load, summer terms or a delayed course, and see how graduation moves — safely.",
  },
  {
    icon: Waypoints,
    title: "Degree Map",
    body: "Click any course to light up what it needs first and everything it unlocks later.",
  },
  {
    icon: Gauge,
    title: "GPA",
    body: "Enter your grades and see your CGPA on Al Ain University's official 4.0 scale, with its official rating.",
  },
  {
    icon: Sparkles,
    title: "AI Coach",
    body: "Portfolio project ideas built on your own courses and checked against what employers want right now.",
  },
  {
    icon: ShieldCheck,
    title: "Honest by design",
    body: "Planning comes from the official study plans, never from AI. No sign-up, and your data stays in your browser.",
  },
];

const steps = [
  {
    n: "01",
    icon: MousePointerClick,
    title: "Choose your major",
    body: "Pick your university and degree. UniPath loads the official study plan for you.",
  },
  {
    n: "02",
    icon: ListChecks,
    title: "Track your progress",
    body: "Tick the courses you've finished. See what's done, what's open, and what's still locked.",
  },
  {
    n: "03",
    icon: CalendarRange,
    title: "Plan your next semester",
    body: "Get a recommended set of courses, and see how each choice moves your graduation date.",
  },
];

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;
const revealStep = ["reveal", "reveal reveal-2", "reveal reveal-3"];

function PreviewSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-5 sm:p-5" aria-hidden>
      <div className="glass h-64 animate-pulse rounded-xl sm:col-span-3" />
      <div className="glass h-64 animate-pulse rounded-xl sm:col-span-2" />
    </div>
  );
}

function SectionHeading({ eyebrow, title, body }: { eyebrow: string; title: string; body?: string }) {
  return (
    <div className="reveal max-w-2xl">
      <p className="num text-[11.5px] font-semibold uppercase tracking-[0.14em] text-accent">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
      {body && <p className="mt-3 text-[15px] leading-relaxed text-muted">{body}</p>}
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <div aria-hidden className="scroll-progress fixed inset-x-0 top-0 z-50 h-[2px] bg-gradient-to-r from-accent via-open to-plan" />

      <header className="glass-bar sticky top-0 z-40 border-b border-line">
        <div className="mx-auto flex h-[60px] max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          <nav aria-label="Site" className="flex items-center gap-1 sm:gap-2">
            <Link href="#features" className="hidden rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:text-fg md:block">
              Features
            </Link>
            <Link href="#how-it-works" className="hidden rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:text-fg md:block">
              How it works
            </Link>
            <Link href="/about" className="hidden rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:text-fg md:block">
              About the data
            </Link>
            <Link href="/start" className={buttonClass("secondary", "sm", "ml-1")}>
              Start planning
            </Link>
            <ThemeToggle className="ml-1" />
          </nav>
        </div>
      </header>

      <main id="main" className="flex-1">
        <section className="relative overflow-hidden">
          {/* Soft glows that drift slower than the page as you scroll. */}
          <div aria-hidden className="parallax pointer-events-none absolute inset-0">
            <div className="float-slow absolute -left-24 top-10 size-[420px] rounded-full bg-accent/20 blur-[110px]" />
            <div className="float-slow absolute -right-20 top-40 size-[380px] rounded-full bg-plan/20 blur-[120px] [animation-delay:-4s]" />
          </div>

          <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 sm:pt-24">
            <div className="max-w-3xl">
              <div className="enter" style={delay(0)}>
                <Pill tone="accent">Built for Al Ain University study plans</Pill>
              </div>
              <h1
                className="enter mt-5 text-[42px] font-semibold leading-[1.04] tracking-tight text-fg sm:text-6xl lg:text-7xl"
                style={delay(90)}
              >
                Your path to graduation, <span className="text-gradient">made clear.</span>
              </h1>
              <p className="enter mt-6 max-w-2xl text-lg leading-relaxed text-muted" style={delay(180)}>
                Track your courses, understand prerequisites, and build a smarter semester plan — all in one place.
              </p>
              <div className="enter mt-8 flex flex-wrap items-center gap-3" style={delay(270)}>
                <Link href="/start" className={buttonClass("primary", "lg", "transition-transform hover:-translate-y-0.5")}>
                  Start Planning <ArrowRight />
                </Link>
                <Link href="/demo" className={buttonClass("secondary", "lg", "transition-transform hover:-translate-y-0.5")}>
                  Try Demo
                </Link>
                <BrowserOnly fallback={null}>
                  <ContinueLink />
                </BrowserOnly>
              </div>
              <p className="enter mt-4 flex items-center gap-2 text-[13px] text-dim" style={delay(360)}>
                <Lock aria-hidden className="size-3.5" /> No sign-up. Your progress is saved in this browser only.
              </p>
            </div>

            <figure className="tilt-in relative mt-16">
              <div aria-hidden className="absolute -inset-x-10 -top-10 bottom-0 rounded-[40px] bg-accent/10 blur-3xl" />
              <div className="glass-pop relative overflow-hidden rounded-3xl border border-line-strong">
                <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
                  <div className="flex gap-1.5" aria-hidden>
                    <span className="size-2.5 rounded-full bg-danger/60" />
                    <span className="size-2.5 rounded-full bg-warn/60" />
                    <span className="size-2.5 rounded-full bg-done/60" />
                  </div>
                  <figcaption className="num truncate text-[11px] uppercase tracking-[0.1em] text-dim">
                    Live preview · sample Software Engineering student
                  </figcaption>
                </div>
                <BrowserOnly fallback={<PreviewSkeleton />}>
                  <LivePreview />
                </BrowserOnly>
              </div>
            </figure>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6">
          <SectionHeading
            eyebrow="Features"
            title="Everything about your degree, in one calm place"
            body="Six screens and a what-if simulator, no clutter. Each one answers a question students actually ask."
          />
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <li
                  key={f.title}
                  className={cn(
                    revealStep[Math.min(i % 4, 2)],
                    "glass group rounded-2xl border border-line p-6 transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-[0_24px_60px_-30px_var(--accent)]",
                  )}
                >
                  <span className="flex size-11 items-center justify-center rounded-xl border border-accent/30 bg-accent-soft text-accent transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">
                    <Icon aria-hidden className="size-5" />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.body}</p>
                </li>
              );
            })}
          </ul>
        </section>

        <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6">
          <SectionHeading eyebrow="How it works" title="Three steps. About a minute." />
          <div className="relative mt-10">
            <div
              aria-hidden
              className="absolute left-8 right-8 top-[46px] hidden h-px bg-gradient-to-r from-accent/50 via-open/40 to-plan/50 md:block"
            />
            <ol className="relative grid gap-4 md:grid-cols-3">
              {steps.map((s, i) => {
                const Icon = s.icon;
                return (
                  <li key={s.n} className={cn(revealStep[i], "glass relative rounded-2xl border border-line p-6")}>
                    <div className="flex items-center justify-between">
                      <span className="flex size-10 items-center justify-center rounded-xl border border-accent/30 bg-accent-soft text-accent">
                        <Icon aria-hidden className="size-5" />
                      </span>
                      <span className="num text-sm text-dim">{s.n}</span>
                    </div>
                    <h3 className="mt-5 text-lg font-semibold">{s.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.body}</p>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-24 pt-4 sm:px-6">
          <div className="reveal glass-pop relative overflow-hidden rounded-3xl border border-line-strong px-6 py-12 text-center sm:px-12">
            <div aria-hidden className="absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full bg-accent/25 blur-[90px]" />
            <h2 className="relative text-3xl font-semibold tracking-tight sm:text-4xl">
              Ready to see your <span className="text-gradient">path?</span>
            </h2>
            <p className="relative mx-auto mt-3 max-w-xl text-muted">
              Pick your major and tick what you&apos;ve finished. Your personal roadmap is ready in about a minute.
            </p>
            <div className="relative mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/start" className={buttonClass("primary", "lg", "transition-transform hover:-translate-y-0.5")}>
                Start Planning <ArrowRight />
              </Link>
              <Link href="/demo" className={buttonClass("secondary", "lg", "transition-transform hover:-translate-y-0.5")}>
                Try Demo
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
