import { Search } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function SearchInput({ className, label, ...props }: ComponentProps<"input"> & { label: string }) {
  return (
    <div className={cn("relative", className)}>
      <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dim" />
      <input
        type="search"
        aria-label={label}
        className="h-10 w-full rounded-[10px] border border-line bg-bg/60 pl-9 pr-3 text-sm text-fg placeholder:text-dim hover:border-line-strong focus:border-accent focus:outline-none"
        {...props}
      />
    </div>
  );
}

export function Select({ className, label, children, ...props }: ComponentProps<"select"> & { label: string }) {
  return (
    <select
      aria-label={label}
      className={cn(
        "h-10 rounded-[10px] border border-line bg-bg/60 px-3 pr-8 text-sm text-fg hover:border-line-strong focus:border-accent focus:outline-none",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
