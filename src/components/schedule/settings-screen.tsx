"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell/app-shell";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, NativeSelect } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import type { LifeSettings } from "@/lib/schedule/schema";
import { deviceTimeZone } from "@/lib/schedule/time";
import { useAppStore } from "@/lib/state/store";
import { AttendanceRuleFields } from "./attendance-rule-fields";
import { useSchedule } from "./schedule-context";

const OFFSETS: { value: number; label: string }[] = [
  { value: 5, label: "5 minutes before" },
  { value: 10, label: "10 minutes before" },
  { value: 15, label: "15 minutes before" },
  { value: 30, label: "30 minutes before" },
  { value: 60, label: "1 hour before" },
  { value: 120, label: "2 hours before" },
  { value: 360, label: "6 hours before" },
  { value: 720, label: "12 hours before" },
  { value: 1440, label: "1 day before" },
  { value: 2880, label: "2 days before" },
  { value: 4320, label: "3 days before" },
  { value: 10080, label: "1 week before" },
  { value: 20160, label: "2 weeks before" },
];

const REMINDERS: { key: keyof LifeSettings["reminders"]; label: string; max: number }[] = [
  { key: "classes", label: "Classes", max: 1440 },
  { key: "assignments", label: "Assignments and projects", max: 20160 },
  { key: "exams", label: "Quizzes and exams", max: 20160 },
  { key: "deadlines", label: "Registration, payment and admin deadlines", max: 20160 },
  { key: "events", label: "Events", max: 10080 },
];

function zones(): string[] {
  try {
    return (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
  } catch {
    return [];
  }
}

function NumberSetting({ label, hint, value, min, max, onChange }: { label: string; hint: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <Field label={label} hint={hint}>
      {(id) => <Input id={id} type="number" min={min} max={max} value={value} onChange={(e) => onChange(Math.max(min, Math.min(max, Math.round(Number(e.target.value) || 0))))} />}
    </Field>
  );
}

export function SettingsScreen() {
  const { life } = useSchedule();
  const update = (fn: (l: LifeSettings) => LifeSettings) => useAppStore.getState().updateLife(fn);
  const [permission, setPermission] = useState(() => (typeof Notification === "undefined" ? "unsupported" : Notification.permission));
  const device = deviceTimeZone();

  const toggleBrowser = async (on: boolean) => {
    if (!on) return update((l) => ({ ...l, browserNotifications: false }));
    if (typeof Notification === "undefined") return toast("This browser doesn't support notifications.");
    const result = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    setPermission(result);
    if (result === "granted") update((l) => ({ ...l, browserNotifications: true }));
    else toast("Notifications are blocked for this site. You can allow them in your browser's site settings.");
  };

  return (
    <div className="page-in mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <PageHeader title="Settings" description="Reminders, conflict checks and the rules UniPath uses. Changes save straight away." />
      <div className="mt-6 space-y-4">
        <Card aria-labelledby="rem-title">
          <CardHeader titleId="rem-title" title="Reminders" />
          <CardBody className="space-y-3">
            {REMINDERS.map((r) => (
              <Field key={r.key} label={r.label}>
                {(id) => (
                  <NativeSelect
                    id={id}
                    value={life.reminders[r.key] ?? "off"}
                    onChange={(e) => update((l) => ({ ...l, reminders: { ...l.reminders, [r.key]: e.target.value === "off" ? null : Number(e.target.value) } }))}
                  >
                    <option value="off">No reminder</option>
                    {OFFSETS.filter((o) => o.value <= r.max).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </Field>
            ))}
            <div className="border-t border-line pt-3">
              <Switch
                checked={life.browserNotifications && permission === "granted"}
                onChange={toggleBrowser}
                label="Browser notifications"
                description="Pop-up reminders while UniPath is open in a tab. UniPath has no server that can reach you when the browser is closed, so keep an eye on the bell too."
              />
              {permission === "denied" && <p className="mt-1 text-[12.5px] text-warn">Blocked in this browser. Allow notifications for this site in your browser settings.</p>}
              {permission === "unsupported" && <p className="mt-1 text-[12.5px] text-muted">This browser doesn&apos;t support notifications.</p>}
            </div>
          </CardBody>
        </Card>

        <Card aria-labelledby="checks-title">
          <CardHeader titleId="checks-title" title="Conflict checks" description="Your own thresholds. UniPath doesn't know your campus layout or exam rules." />
          <CardBody className="grid gap-3 sm:grid-cols-2">
            <NumberSetting label="Time I need to change buildings (min)" hint="0 turns this check off" value={life.travelBufferMin} min={0} max={120} onChange={(v) => update((l) => ({ ...l, travelBufferMin: v }))} />
            <NumberSetting label="Warn when exams are closer than (min)" hint="Gap between the end of one and the start of the next" value={life.examGapMin} min={0} max={600} onChange={(v) => update((l) => ({ ...l, examGapMin: v }))} />
            <NumberSetting label="Deadlines on one day before warning" hint="2 to 6" value={life.clusterThreshold} min={2} max={6} onChange={(v) => update((l) => ({ ...l, clusterThreshold: v }))} />
            <NumberSetting label="Warn about admin deadlines (days ahead)" hint="Registration, payment and similar" value={life.adminWarnDays} min={1} max={30} onChange={(v) => update((l) => ({ ...l, adminWarnDays: v }))} />
          </CardBody>
        </Card>

        <Card aria-labelledby="att-title">
          <CardHeader titleId="att-title" title="Attendance rule" description="Enter your university's rule from the student handbook. You can set a different rule for a course on the Attendance page." />
          <CardBody className="space-y-3">
            <AttendanceRuleFields rule={life.attendance} onChange={(rule) => update((l) => ({ ...l, attendance: { ...l.attendance, ...rule } }))} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="A late arrival counts as">
                {(id) => (
                  <NativeSelect id={id} value={life.attendance.late} onChange={(e) => update((l) => ({ ...l, attendance: { ...l.attendance, late: e.target.value as "present" | "absent" } }))}>
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                  </NativeSelect>
                )}
              </Field>
              <NumberSetting label="Warn when this many absences are left" hint="0 = only when none are left" value={life.attendance.warnAt} min={0} max={20} onChange={(v) => update((l) => ({ ...l, attendance: { ...l.attendance, warnAt: v } }))} />
            </div>
            <p className="text-[12.5px] text-muted">Excused absences don&apos;t count either way.</p>
          </CardBody>
        </Card>

        <Card aria-labelledby="gpa-title">
          <CardHeader titleId="gpa-title" title="GPA" />
          <CardBody>
            <Field label="When a course is repeated" hint="Your university's grading page doesn't say which attempt counts. Check your transcript or ask the registrar.">
              {(id) => (
                <NativeSelect id={id} value={life.repeatPolicy} onChange={(e) => update((l) => ({ ...l, repeatPolicy: e.target.value as LifeSettings["repeatPolicy"] }))}>
                  <option value="all">Every attempt counts</option>
                  <option value="latest">Only the latest attempt counts</option>
                </NativeSelect>
              )}
            </Field>
          </CardBody>
        </Card>

        <Card aria-labelledby="tz-title">
          <CardHeader titleId="tz-title" title="Time zone" />
          <CardBody>
            <Field label="Campus time zone" hint="Today's classes and reminders use this. Leave it on your device's zone unless you're away from campus.">
              {(id) => (
                <NativeSelect id={id} value={life.timeZone ?? ""} onChange={(e) => update((l) => ({ ...l, timeZone: e.target.value || null }))}>
                  <option value="">This device ({device})</option>
                  {zones().map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
          </CardBody>
        </Card>

        <Card aria-labelledby="home-title">
          <CardHeader titleId="home-title" title="Home" />
          <CardBody>
            <Switch
              checked={!life.setup.hidden}
              onChange={(on) => update((l) => ({ ...l, setup: { ...l.setup, hidden: !on, skipped: on ? [] : l.setup.skipped } }))}
              label="Show the getting-started checklist"
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
