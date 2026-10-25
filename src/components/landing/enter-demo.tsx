"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAppStore } from "@/lib/state/store";

/** Switches to the sample student (keeping any personal plan untouched) and opens the dashboard. */
export function EnterDemo() {
  const router = useRouter();
  useEffect(() => {
    useAppStore.getState().enterDemo();
    router.replace("/overview");
  }, [router]);
  return null;
}
