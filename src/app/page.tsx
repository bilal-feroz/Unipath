import { ArrowRight, CalendarRange, ListChecks, Lock, MousePointerClick } from "lucide-react";
import Link from "next/link";
import { BrowserOnly } from "@/components/browser-only";
import { ContinueLink } from "@/components/landing/continue-link";
import { LivePreview } from "@/components/landing/live-preview";
import { Logo } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
import { buttonClass } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";

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

function PreviewSkeleton() {
  return (
    <div className="grid gap-3 p-4 sm:grid-cols-5 sm:p-5" aria-hidden>
      <div className="h-64 animate-pulse rounded-xl bg-surface sm:col-span-3" />
      <div className="h-64 animate-pulse rounded-xl bg-surface sm:col-span-2" />
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line bg-bg-elev/80">
        <div className="mx-auto flex h-[60px] max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          <nav aria-label="Site" className="flex items-center gap-1 sm:gap-2">
            <Link href="#how-it-works" className="hidden px-3 py-2 text-sm text-muted hover:text-fg sm:block">
              How it works
            </Link>
            <Link href="/about" className="hidden px-3 py-2 text-sm text-muted hover:text-fg sm:block">
              About the data
            </Link>
            <Link href="/start" className={buttonClass("secondary", "sm")}>
              Start planning
            </Link>
          </nav>
        </div>
      </header>

      <main id="main" className="flex-1">
        <section className="bg-grid relative overflow-hidden border-b border-line">
          <div className="mx-auto max-w-6xl px-4 pb-14 pt-16 sm:px-6 sm:pt-24">
            <div className="max-w-3xl">
              <Pill tone="accent">Built for Al Ain University study plans</Pill>
              <h1 className="mt-5 text-[40px] font-semibold leading-[1.05] tracking-tight text-fg sm:text-6xl">
                Your path to graduation, <span className="text-accent">made clear.</span>
              </h1>
              <p className="mt-5 max-w-2xl text-lg text-muted">
                Track your courses, understand prerequisites, and build a smarter semester plan — all in one place.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/start" className={buttonClass("primary", "lg")}>
                  Start Planning <ArrowRight />
                </Link>
                <Link href="/demo" className={buttonClass("secondary", "lg")}>
                  Try Demo
                </Link>
                <BrowserOnly fallback={null}>
                  <ContinueLink />
                </BrowserOnly>
              </div>
              <p className="mt-4 flex items-center gap-2 text-[13px] text-dim">
                <Lock aria-hidden className="size-3.5" /> No sign-up. Your progress is saved in this browser only.
              </p>
            </div>

            <figure className="mt-14 overflow-hidden rounded-2xl border border-line-strong bg-bg-elev shadow-card">
              <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
                <div className="flex gap-1.5" aria-hidden>
                  <span className="size-2.5 rounded-full bg-line-strong" />
                  <span className="size-2.5 rounded-full bg-line-strong" />
                  <span className="size-2.5 rounded-full bg-line-strong" />
                </div>
                <figcaption className="num text-[11px] uppercase tracking-[0.1em] text-dim">
                  Live preview · sample Software Engineering student
                </figcaption>
              </div>
              <BrowserOnly fallback={<PreviewSkeleton />}>
                <LivePreview />
              </BrowserOnly>
            </figure>
          </div>
        </section>

        <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-8 px-4 py-16 sm:px-6">
          <p className="num text-[11.5px] font-semibold uppercase tracking-[0.14em] text-accent">How it works</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Three steps. About a minute.</h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {steps.map((s) => {
              const Icon = s.icon;
              return (
                <li key={s.n} className="rounded-2xl border border-line bg-surface p-6">
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
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/start" className={buttonClass("primary", "lg")}>
              Start Planning <ArrowRight />
            </Link>
            <Link href="/demo" className={buttonClass("ghost", "lg")}>
              Or explore a sample student
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
