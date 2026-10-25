"use client";

import { FlaskConical, Info, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { BrowserOnly } from "@/components/browser-only";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { getUniversity } from "@/lib/curriculum/registry";
import { usePlan } from "@/lib/state/use-plan";
import { useAppStore } from "@/lib/state/store";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav";
import { PlanProvider } from "./plan-context";
import { SettingsMenu } from "./settings-menu";

function DesktopNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="hidden items-center md:flex">
      {NAV_ITEMS.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex h-[60px] items-center gap-2 px-2.5 text-[14px] transition-colors lg:px-3 xl:px-3.5",
              active ? "font-semibold text-fg" : "text-muted hover:text-fg",
            )}
          >
            <span className={cn("num hidden text-[11.5px] xl:inline", active ? "text-accent" : "text-dim")}>{item.n}</span>
            <span className="xl:hidden">{item.short}</span>
            <span className="hidden xl:inline">{item.label}</span>
            {active && (
              <span className="absolute inset-x-3 bottom-0 h-[2px] rounded-full bg-accent shadow-[0_0_10px_var(--accent)]" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="glass-bar fixed inset-x-0 bottom-0 z-40 border-t border-line pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-6">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[10.5px] font-medium",
                  active ? "text-accent" : "text-muted",
                )}
              >
                <Icon aria-hidden className="size-5" />
                {item.short}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Banners() {
  const isDemo = useAppStore((s) => s.activeProfile === "demo");
  const notice = useAppStore((s) => s.notice);
  const dismissNotice = useAppStore((s) => s.dismissNotice);
  return (
    <>
      {notice && (
        <div role="status" className="border-b border-warn/30 bg-warn-soft">
          <div className="mx-auto flex max-w-6xl items-start gap-3 px-4 py-2.5 text-sm text-fg sm:px-6">
            <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-warn" />
            <p className="flex-1">{notice}</p>
            <button onClick={dismissNotice} aria-label="Dismiss message" className="text-muted hover:text-fg">
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}
      {isDemo && (
        <div className="border-b border-plan/25 bg-plan-soft">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-[13px] sm:px-6">
            <FlaskConical aria-hidden className="size-4 text-plan" />
            <p className="flex-1 text-fg">
              <span className="font-semibold">Demo mode.</span>{" "}
              <span className="text-muted">You&apos;re exploring a sample Software Engineering student. Changes stay in demo mode.</span>
            </p>
            <Link href="/start" className="font-semibold text-plan underline-offset-4 hover:underline">
              Start my own plan →
            </Link>
          </div>
        </div>
      )}
    </>
  );
}

function NoPlan() {
  const router = useRouter();
  const enterDemo = useAppStore((s) => s.enterDemo);
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Let&apos;s set up your plan</h1>
      <p className="mt-2 text-muted">Choose your major and mark the courses you&apos;ve finished. It takes about a minute.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button asChild size="lg">
          <Link href="/start">Start planning</Link>
        </Button>
        <Button
          variant="secondary"
          size="lg"
          onClick={() => {
            enterDemo();
            router.push("/overview");
          }}
        >
          Try demo
        </Button>
      </div>
    </div>
  );
}

function ShellFrame({ right, children }: { right?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="glass-bar sticky top-0 z-40 border-b border-line">
        <div className="mx-auto grid h-[60px] max-w-6xl grid-cols-[1fr_auto] items-center gap-4 px-4 sm:px-6 md:grid-cols-[1fr_auto_1fr]">
          <Logo href="/overview" />
          <DesktopNav />
          <div className="flex items-center justify-end gap-2">
            {right}
            <ThemeToggle />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}

function ShellContent({ children }: { children: ReactNode }) {
  const plan = usePlan();
  if (!plan) {
    return (
      <ShellFrame>
        <Banners />
        <main id="main" className="flex-1">
          <NoPlan />
        </main>
      </ShellFrame>
    );
  }
  const university = getUniversity(plan.curriculum.universityId);
  return (
    <PlanProvider plan={plan}>
      <ShellFrame
        right={
          <>
            <Link
              href="/about"
              className="hidden items-center gap-2 rounded-lg border border-line bg-surface-2/60 px-2.5 py-1.5 text-[13px] text-muted hover:border-line-strong hover:text-fg 2xl:flex"
              title={`${plan.curriculum.degree} in ${plan.curriculum.majorName}, ${university?.name}`}
            >
              <Pill tone="accent" className="h-5 px-1.5">
                {university?.shortName}
              </Pill>
              <span className="max-w-[160px] truncate font-medium text-fg">{plan.curriculum.majorName}</span>
            </Link>
            <SettingsMenu />
          </>
        }
      >
        <Banners />
        <main id="main" className="flex-1 pb-24 md:pb-12">
          {children}
        </main>
        <MobileNav />
      </ShellFrame>
    </PlanProvider>
  );
}

function ShellSkeleton() {
  return (
    <ShellFrame>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6" aria-busy="true">
        <p className="sr-only">Loading your plan…</p>
        <div className="h-8 w-64 animate-pulse rounded-lg bg-surface-2" />
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="glass h-40 animate-pulse rounded-2xl md:col-span-2" />
          <div className="glass h-40 animate-pulse rounded-2xl" />
        </div>
      </main>
    </ShellFrame>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <BrowserOnly fallback={<ShellSkeleton />}>
      <ShellContent>{children}</ShellContent>
    </BrowserOnly>
  );
}

/** Consistent page heading for every app screen. */
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="num text-[11.5px] font-semibold uppercase tracking-[0.14em] text-accent">{eyebrow}</p>
        <h1 className="mt-1.5 text-[26px] font-semibold leading-tight tracking-tight text-fg sm:text-[30px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[15px] text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
