"use client";

import { Moon, Sun } from "lucide-react";
import { useRef } from "react";
import { toggleTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/**
 * Light/dark switch. The icon is driven by the data-theme attribute (not React state),
 * so the server-rendered markup always matches the browser.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => toggleTheme(ref.current)}
      aria-label="Switch between light and dark theme"
      title="Switch theme"
      className={cn(
        "group relative inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-line bg-surface-2 text-fg backdrop-blur transition-[border-color,box-shadow,transform] duration-300 hover:border-line-strong hover:shadow-[0_0_0_4px_var(--accent-soft)] active:scale-95",
        className,
      )}
    >
      <Sun
        aria-hidden
        className="absolute size-[18px] rotate-90 scale-50 opacity-0 transition-all duration-500 ease-[cubic-bezier(.34,1.56,.64,1)] dark:rotate-0 dark:scale-100 dark:opacity-100"
      />
      <Moon
        aria-hidden
        className="absolute size-[18px] rotate-0 scale-100 opacity-100 transition-all duration-500 ease-[cubic-bezier(.34,1.56,.64,1)] dark:-rotate-90 dark:scale-50 dark:opacity-0"
      />
    </button>
  );
}
