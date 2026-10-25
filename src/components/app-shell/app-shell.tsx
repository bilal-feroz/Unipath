"use client";

import { ChevronDown, FlaskConical, Info, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { BrowserOnly } from "@/components/browser-only";
import { Logo } from "@/components/logo";
import { NotificationBell } from "@/components/schedule/notification-bell";
import { ScheduleProvider } from "@/components/schedule/schedule-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { usePlan } from "@/lib/state/use-plan";
import { useAppStore } from "@/lib/state/store";
import { cn } from "@/lib/utils";
import { groupIsActive, isActive, MOBILE_TABS, NAV_GROUPS } from "./nav";
import { PlanProvider } from "./plan-context";
import { SettingsMenu } from "./settings-menu";

const topItem = "relative flex h-[60px] items-center gap-1 whitespace-nowrap px-3 text-[14px] transition-colors xl:px-3.5";

function ActiveBar() {
  return <span className="absolute inset-x-3 bottom-0 h-[2px] rounded-full bg-accent" />;
}

function DesktopNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="hidden items-center lg:flex">
      {NAV_GROUPS.map((group) => {
        const active = groupIsActive(pathname, group);
        if (group.href) {
          return (
            <Link
              key={group.id}
              href={group.href}
              aria-current={active ? "page" : undefined}
              aria-label={group.label === group.short ? undefined : group.label}
              className={cn(topItem, active ? "font-medium text-fg" : "text-muted hover:text-fg")}
            >
              {group.short}
              {active && <ActiveBar />}
            </Link>
          );
        }
        return (
          <DropdownMenu key={group.id}>
            <DropdownMenuTrigger className={cn(topItem, "outline-none", active ? "font-medium text-fg" : "text-muted hover:text-fg data-[state=open]:text-fg")}>
              {group.label}
              <ChevronDown aria-hidden className="size-3.5 opacity-70" />
              {active && <ActiveBar />}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[220px]">
              {group.items.map((item) => {
                const Icon = item.icon;
                const here = isActive(pathname, item.href);
                return (
                  <DropdownMenuItem key={item.href} asChild className={here ? "font-medium text-accent [&_svg]:!text-accent" : undefined}>
                    <Link href={item.href} aria-current={here ? "page" : undefined}>
                      <Icon /> {item.label}
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      })}
    </nav>
  );
}

function MobileNav() {
  const pathname = usePathname();
  const [more, setMore] = useState(false);
  const inTabs = MOBILE_TABS.some((t) => isActive(pathname, t.href));
  return (
    <nav
      aria-label="Main"
      className="glass-bar fixed inset-x-0 bottom-0 z-40 border-t border-line pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {MOBILE_TABS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                aria-label={item.label === item.short ? undefined : item.label}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium",
                  active ? "text-accent" : "text-muted",
                )}
              >
                <Icon aria-hidden className="size-5" />
                {item.short}
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={() => setMore(true)}
            aria-haspopup="dialog"
            className={cn("flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium", !inTabs ? "text-accent" : "text-muted")}
          >
            <Menu aria-hidden className="size-5" />
            More
          </button>
        </li>
      </ul>
      <Dialog open={more} onOpenChange={setMore}>
        <DialogContent title="Everything in UniPath" side="right">
          <div className="space-y-5 pb-2">
            {NAV_GROUPS.map((group) => {
              const items = group.href ? [{ href: group.href, label: group.label, short: group.short, icon: group.icon }] : group.items;
              return (
                <section key={group.id}>
                  {!group.href && <h3 className="mb-1.5 text-[12.5px] font-medium text-muted">{group.label}</h3>}
                  <ul className="space-y-1">
                    {items.map((item) => {
                      const Icon = item.icon;
                      const here = isActive(pathname, item.href);
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={() => setMore(false)}
                            aria-current={here ? "page" : undefined}
                            className={cn(
                              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px]",
                              here ? "bg-accent-soft font-medium text-fg" : "text-fg hover:bg-surface-2",
                            )}
                          >
                            <Icon aria-hidden className={cn("size-5", here ? "text-accent" : "text-muted")} />
                            {item.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
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
              <span className="text-muted sm:hidden">Sample student.</span>
              <span className="hidden text-muted sm:inline">
                You&apos;re exploring a sample Software Engineering student. Changes stay in demo mode.
              </span>
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
        <div className="mx-auto grid h-[60px] max-w-6xl grid-cols-[1fr_auto] items-center gap-4 px-4 sm:px-6 lg:grid-cols-[auto_1fr_auto] lg:[&>nav]:justify-center">
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
  return (
    <PlanProvider plan={plan}>
      <ScheduleProvider>
        <ShellFrame
          right={
            <>
              <NotificationBell />
              <SettingsMenu />
            </>
          }
        >
          <Banners />
          <main id="main" className="flex-1 pb-24 lg:pb-12">
            {children}
          </main>
          <MobileNav />
        </ShellFrame>
      </ScheduleProvider>
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
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-fg sm:text-[30px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[15px] text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
