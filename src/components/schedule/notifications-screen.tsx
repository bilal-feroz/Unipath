"use client";

import { BellRing, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/app-shell/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/form";
import { useAppStore } from "@/lib/state/store";
import { AlertCard } from "./alert-card";
import { NotificationRow } from "./notification-bell";
import { useSchedule } from "./schedule-context";

export function NotificationsScreen() {
  const { notifications, alerts, allAlerts, schedule, unread } = useSchedule();
  const read = new Set(schedule.notifications.read);
  const reminders = notifications.filter((n) => !n.id.startsWith("alert:"));
  const hidden = allAlerts.length - alerts.length;

  return (
    <div className="page-in mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Notifications"
        description="Reminders, timetable changes and anything UniPath spotted that needs your attention."
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link href="/settings">Reminder settings</Link>
            </Button>
            {unread > 0 && <Button onClick={() => useAppStore.getState().markNotificationsRead(notifications.map((n) => n.id))}>Mark all read</Button>}
          </div>
        }
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card aria-labelledby="alerts-title">
          <CardHeader titleId="alerts-title" title="Needs attention" description="Conflicts and risks, with what to do about them." />
          <CardBody>
            {alerts.length === 0 ? (
              <EmptyState icon={<ShieldCheck />} title="No problems found">
                UniPath checks your timetable, deadlines, exams, events and attendance as you add them.
              </EmptyState>
            ) : (
              <ul className="space-y-2.5">
                {alerts.map((a) => (
                  <li key={a.id}>
                    <AlertCard alert={a} />
                  </li>
                ))}
              </ul>
            )}
            {hidden > 0 && (
              <button type="button" onClick={() => useAppStore.getState().restoreAlerts()} className="mt-3 text-[13px] font-medium text-accent hover:text-accent-strong">
                Show {hidden} dismissed, resolved or snoozed alert{hidden === 1 ? "" : "s"}
              </button>
            )}
          </CardBody>
        </Card>
        <Card aria-labelledby="reminders-title">
          <CardHeader titleId="reminders-title" title="Reminders" description="Based on your reminder settings." />
          <CardBody>
            {reminders.length === 0 ? (
              <EmptyState icon={<BellRing />} title="No reminders right now">
                Reminders appear here before classes, deadlines, exams and events.
              </EmptyState>
            ) : (
              <ul className="-mx-2">
                {reminders.map((n) => (
                  <li key={n.id}>
                    <NotificationRow n={n} unread={!read.has(n.id)} />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
