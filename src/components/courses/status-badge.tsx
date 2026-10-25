import { CalendarCheck, CircleCheck, CircleDot, Lock } from "lucide-react";
import type { CourseStatus } from "@/lib/engine";
import { cn } from "@/lib/utils";

export const STATUS_META: Record<
  CourseStatus,
  { label: string; icon: typeof Lock; text: string; soft: string; border: string; description: string }
> = {
  completed: {
    label: "Completed",
    icon: CircleCheck,
    text: "text-done",
    soft: "bg-done-soft",
    border: "border-done/40",
    description: "You've finished this course.",
  },
  planned: {
    label: "Planned",
    icon: CalendarCheck,
    text: "text-plan",
    soft: "bg-plan-soft",
    border: "border-plan/45",
    description: "In your plan for next semester.",
  },
  eligible: {
    label: "Available",
    icon: CircleDot,
    text: "text-open",
    soft: "bg-open-soft",
    border: "border-open/40",
    description: "You can take this now — its prerequisites are done.",
  },
  locked: {
    label: "Locked",
    icon: Lock,
    text: "text-lock",
    soft: "bg-lock-soft",
    border: "border-lock/30",
    description: "You need to complete other courses first.",
  },
};

export const STATUS_ORDER: CourseStatus[] = ["completed", "planned", "eligible", "locked"];

export function StatusBadge({ status, className, compact }: { status: CourseStatus; className?: string; compact?: boolean }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-md border px-2 text-[12px] font-medium",
        meta.text,
        meta.soft,
        meta.border,
        className,
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      <span className={cn(compact && "sr-only")}>{meta.label}</span>
    </span>
  );
}
