"use client";

import {
  AlarmClock,
  Bell,
  BookOpen,
  CalendarClock,
  CalendarX,
  Footprints,
  GraduationCap,
  PartyPopper,
  TriangleAlert,
  UserCheck,
} from "lucide-react";
import Link from "next/link";
import { Popover } from "radix-ui";
import type { AppNotification, NotificationCategory } from "@/lib/schedule/reminders";
import { useAppStore } from "@/lib/state/store";
import { cn } from "@/lib/utils";
import { useSchedule } from "./schedule-context";

export const NOTIFICATION_ICON: Record<NotificationCategory, typeof Bell> = {
  class: GraduationCap,
  assignment: BookOpen,
  exam: AlarmClock,
  deadline: CalendarClock,
  event: PartyPopper,
  timetable: CalendarX,
  attendance: UserCheck,
  conflict: TriangleAlert,
  travel: Footprints,
};

export function NotificationRow({ n, unread, onOpen }: { n: AppNotification; unread: boolean; onOpen?: () => void }) {
  const Icon = NOTIFICATION_ICON[n.category];
  return (
    <Link
      href={n.href}
      onClick={() => {
        useAppStore.getState().markNotificationsRead([n.id]);
        onOpen?.();
      }}
      className="flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-2"
    >
      <span
        className={cn(
          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border",
          n.urgent ? "border-danger/40 bg-danger-soft text-danger" : "border-line bg-surface-2 text-muted",
        )}
      >
        <Icon aria-hidden className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block text-sm leading-snug", unread ? "font-semibold text-fg" : "text-fg")}>{n.title}</span>
        {n.body && <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">{n.body}</span>}
      </span>
      {unread && <span aria-label="Unread" className="mt-2 size-2 shrink-0 rounded-full bg-accent" />}
    </Link>
  );
}

export function NotificationBell() {
  const { notifications, unread, schedule } = useSchedule();
  const read = new Set(schedule.notifications.read);
  const top = notifications.slice(0, 6);
  return (
    <Popover.Root>
      <Popover.Trigger className="relative inline-flex size-10 items-center justify-center rounded-[10px] border border-line bg-surface-2 text-fg hover:border-line-strong">
        <Bell aria-hidden className="size-4" />
        <span className="sr-only">{unread ? `Notifications, ${unread} unread` : "Notifications"}</span>
        {unread > 0 && (
          <span
            aria-hidden
            className="num absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10.5px] font-semibold text-bg"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="glass-pop z-50 w-[min(380px,calc(100vw-24px))] rounded-2xl border border-line-strong p-2 text-fg data-[state=open]:animate-fade-in"
        >
          <div className="flex items-center justify-between px-3 pb-1 pt-1.5">
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => useAppStore.getState().markNotificationsRead(notifications.map((n) => n.id))}
                className="text-[12.5px] font-medium text-accent hover:text-accent-strong"
              >
                Mark all read
              </button>
            )}
          </div>
          {top.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted">You&apos;re all caught up.</p>
          ) : (
            <ul>
              {top.map((n) => (
                <li key={n.id}>
                  <Popover.Close asChild>
                    <NotificationRow n={n} unread={!read.has(n.id)} />
                  </Popover.Close>
                </li>
              ))}
            </ul>
          )}
          <Popover.Close asChild>
            <Link href="/notifications" className="mt-1 block rounded-xl px-3 py-2 text-center text-[13px] font-medium text-accent hover:bg-surface-2">
              All notifications and reminder settings
            </Link>
          </Popover.Close>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
