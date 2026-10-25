import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7", className)}>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="var(--accent-soft)" stroke="var(--accent)" strokeOpacity="0.45" />
      <path
        d="M9 22.5c3.5 0 4.5-3 7-6.5s4-6.5 7.5-6.5"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="9" cy="22.5" r="2.4" fill="var(--accent)" />
      <circle cx="23.5" cy="9.5" r="2.4" fill="var(--bg)" stroke="var(--accent)" strokeWidth="2" />
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5", className)} aria-label="UniPath home">
      <LogoMark />
      <span className="text-[18px] font-bold tracking-tight text-fg">UniPath</span>
    </Link>
  );
}
