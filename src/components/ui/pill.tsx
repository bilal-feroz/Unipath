import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const tones = {
  neutral: "border-line-strong bg-surface-2/60 text-muted",
  accent: "border-accent/35 bg-accent-soft text-accent",
  done: "border-done/35 bg-done-soft text-done",
  open: "border-open/35 bg-open-soft text-open",
  plan: "border-plan/35 bg-plan-soft text-plan",
  lock: "border-lock/30 bg-lock-soft text-lock",
  warn: "border-warn/35 bg-warn-soft text-warn",
} as const;

export type PillTone = keyof typeof tones;

/** Small uppercase label, used for tags like "ESTIMATE" or "OFFICIAL DATA". */
export function Pill({ tone = "neutral", className, ...props }: ComponentProps<"span"> & { tone?: PillTone }) {
  return (
    <span
      className={cn(
        "num inline-flex h-[22px] items-center gap-1 whitespace-nowrap rounded-md border px-2 text-[10.5px] font-semibold uppercase tracking-[0.08em]",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
