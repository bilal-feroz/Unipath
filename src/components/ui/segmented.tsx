"use client";

import { RadioGroup } from "radix-ui";
import { cn } from "@/lib/utils";

/** A row of mutually exclusive options (accessible radio group). */
export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; hint?: string }[];
  label: string;
  className?: string;
}) {
  return (
    <RadioGroup.Root
      aria-label={label}
      value={String(value)}
      onValueChange={(v) => {
        const match = options.find((o) => String(o.value) === v);
        if (match) onChange(match.value);
      }}
      orientation="horizontal"
      className={cn("inline-flex flex-wrap gap-1 rounded-[11px] border border-line bg-bg/60 p-1", className)}
    >
      {options.map((o) => (
        <RadioGroup.Item
          key={String(o.value)}
          value={String(o.value)}
          title={o.hint}
          className="num h-8 min-w-11 rounded-lg px-3 text-[13px] text-muted transition-colors hover:text-fg data-[state=checked]:bg-accent data-[state=checked]:font-semibold data-[state=checked]:text-accent-fg"
        >
          {o.label}
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}
