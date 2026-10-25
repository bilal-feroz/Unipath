"use client";

import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { useAppStore } from "@/lib/state/store";

/** Shown to returning students who already have a saved plan. */
export function ContinueLink() {
  const hasPlan = useAppStore((s) => !!s.personal);
  if (!hasPlan) return null;
  return (
    <Link
      href="/overview"
      onClick={() => useAppStore.getState().exitDemo()}
      className={buttonClass("ghost", "lg", "text-accent hover:text-accent-strong")}
    >
      Continue my plan →
    </Link>
  );
}
