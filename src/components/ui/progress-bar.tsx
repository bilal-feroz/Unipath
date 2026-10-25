import { cn } from "@/lib/utils";

export function ProgressBar({
  value,
  max = 100,
  label,
  className,
  tone = "accent",
  size = "md",
}: {
  value: number;
  max?: number;
  label: string;
  className?: string;
  tone?: "accent" | "done" | "plan";
  size?: "sm" | "md" | "lg";
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const fill = { accent: "bg-accent", done: "bg-done", plan: "bg-plan" }[tone];
  const height = { sm: "h-1.5", md: "h-2.5", lg: "h-3.5" }[size];
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn("w-full overflow-hidden rounded-full bg-surface-2", height, className)}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500 ease-out", fill)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
