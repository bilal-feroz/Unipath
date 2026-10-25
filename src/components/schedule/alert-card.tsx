"use client";

import { AlarmClockOff, ArrowRight, Check, Footprints, OctagonAlert, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Alert } from "@/lib/schedule/conflicts";
import { useAppStore } from "@/lib/state/store";
import { cn } from "@/lib/utils";

const TONE = {
  critical: { box: "border-danger/40 bg-danger-soft", icon: "text-danger", Icon: OctagonAlert },
  warning: { box: "border-warn/40 bg-warn-soft", icon: "text-warn", Icon: TriangleAlert },
  info: { box: "border-line-strong bg-surface-2/50", icon: "text-open", Icon: TriangleAlert },
} as const;

/** One alert: what's wrong, why it matters, what's affected, what to do, and how to put it away. */
export function AlertCard({ alert, compact }: { alert: Alert; compact?: boolean }) {
  const tone = TONE[alert.severity];
  const Icon = alert.rule === "travel" ? Footprints : tone.Icon;
  const store = useAppStore.getState();
  const snooze = (days: number) => {
    store.snoozeAlert(alert.id, new Date(Date.now() + days * 86_400_000).toISOString());
    toast(`Snoozed for ${days === 1 ? "a day" : "a week"}`);
  };
  return (
    <div className={cn("rounded-2xl border p-3.5", tone.box)}>
      <div className="flex gap-3">
        <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", tone.icon)} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-fg">{alert.title}</p>
          {!compact && <p className="mt-0.5 text-[13px] text-muted">{alert.why}</p>}
          <p className="mt-1 text-[13px] text-fg">{alert.action}</p>
          {!compact && alert.affected.length > 0 && (
            <p className="mt-1 text-[12px] text-muted">Affects: {alert.affected.map((a) => a.label).join(", ")}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Button asChild size="sm" variant="secondary">
              <Link href={alert.href}>
                Fix it <ArrowRight />
              </Link>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { store.resolveAlert(alert.id); toast("Marked as resolved"); }}>
              <Check /> Resolved
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost">
                  <AlarmClockOff /> Snooze
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[160px]">
                <DropdownMenuItem onSelect={() => snooze(1)}>For a day</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => snooze(7)}>For a week</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" variant="ghost" aria-label={`Dismiss: ${alert.title}`} onClick={() => store.dismissAlert(alert.id)}>
              <X /> Dismiss
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
