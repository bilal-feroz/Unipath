"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePlanContext } from "@/components/app-shell/plan-context";
import { detectConflicts, visibleAlerts, type Alert } from "@/lib/schedule/conflicts";
import { classOccurrences, type ClassOccurrence } from "@/lib/schedule/occurrences";
import { dueNotifications, type AppNotification } from "@/lib/schedule/reminders";
import { defaultLifeSettings, type LifeSettings, type Schedule } from "@/lib/schedule/schema";
import { rankTasks, type RankedTask } from "@/lib/schedule/tasks";
import { minutesUntil, toMinutes, zonedNow, type ZonedNow } from "@/lib/schedule/time";
import { activeProfileOf, scheduleOf, useAppStore } from "@/lib/state/store";

export interface ScheduleView {
  schedule: Schedule;
  life: LifeSettings;
  now: Date;
  zoned: ZonedNow;
  isDemo: boolean;
  title(code: string): string;
  /** All open alerts, before dismissals. */
  allAlerts: Alert[];
  /** Alerts the student hasn't dismissed, resolved or snoozed. */
  alerts: Alert[];
  notifications: AppNotification[];
  unread: number;
  ranked: RankedTask[];
  today: ClassOccurrence[];
  nextClass: { occurrence: ClassOccurrence; minutesUntil: number } | null;
  /** Ids (task, event, occurrence, session) involved in an open alert, for highlighting. */
  flagged: Set<string>;
}

const Ctx = createContext<ScheduleView | null>(null);

/** The current time, updated every 30 seconds (and when the tab comes back into view). */
function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = setInterval(tick, intervalMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [intervalMs]);
  return now;
}

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const plan = usePlanContext();
  const profile = useAppStore((s) => activeProfileOf(s));
  const isDemo = useAppStore((s) => s.activeProfile === "demo");
  const schedule = scheduleOf(profile);
  const life = profile?.life ?? defaultLifeSettings();
  const now = useNow();
  // Recompute derived data once a minute, not on every render.
  const minuteKey = Math.floor(now.getTime() / 60_000);

  const value = useMemo<ScheduleView>(() => {
    const at = new Date(minuteKey * 60_000);
    const zoned = zonedNow(at, life.timeZone);
    const title = (code: string) => plan.index.byCode.get(code)?.title ?? code;
    const allAlerts = detectConflicts(schedule, life, zoned, title);
    const alerts = visibleAlerts(allAlerts, schedule.alerts, at);
    const notifications = dueNotifications(schedule, life, zoned, alerts, title);
    const read = new Set(schedule.notifications.read);
    const today = classOccurrences(schedule, zoned.date, zoned.date);
    const upcoming = classOccurrences(schedule, zoned.date, zonedNow(new Date(at.getTime() + 8 * 86_400_000), life.timeZone).date).filter(
      (o) => o.status === "scheduled" && (o.date > zoned.date || toMinutes(o.end) > zoned.minutes),
    );
    const next = upcoming[0];
    const flagged = new Set(alerts.flatMap((a) => a.affected.map((x) => x.id)));
    return {
      schedule,
      life,
      now: at,
      zoned,
      isDemo,
      title,
      allAlerts,
      alerts,
      notifications,
      unread: notifications.filter((n) => !read.has(n.id)).length,
      ranked: rankTasks(schedule.tasks, zoned, life.clusterThreshold),
      today,
      nextClass: next ? { occurrence: next, minutesUntil: minutesUntil(zoned, next.date, next.start) } : null,
      flagged,
    };
  }, [schedule, life, plan.index, minuteKey, isDemo]);

  // Browser notifications, only while UniPath is open and only if the student turned them on.
  const { notifications, schedule: sch } = value;
  useEffect(() => {
    if (!life.browserNotifications || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const delivered = new Set(sch.notifications.delivered);
    const fresh = notifications.filter((n) => !delivered.has(n.id) && n.category !== "conflict" && n.category !== "attendance");
    if (fresh.length === 0) return;
    for (const n of fresh.slice(0, 3)) {
      try {
        new Notification(n.title, { body: n.body, tag: n.id });
      } catch {
        // Some browsers only allow notifications from a service worker; the in-app centre still has them.
      }
    }
    useAppStore.getState().markDelivered(fresh.map((n) => n.id));
  }, [notifications, sch.notifications.delivered, life.browserNotifications]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSchedule(): ScheduleView {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSchedule must be used inside the app shell");
  return v;
}
