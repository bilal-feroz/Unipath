import type { Metadata } from "next";
import { BrowserOnly } from "@/components/browser-only";
import { Logo } from "@/components/logo";
import { Onboarding } from "@/components/onboarding/onboarding";

// Rendered in the browser from locally saved progress, so there is no server-rendered UI to validate for instant navigation.
export const instant = false;

export const metadata: Metadata = { title: "Start planning" };

export default function StartPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line bg-bg-elev/80">
        <div className="mx-auto flex h-[60px] max-w-3xl items-center px-4 sm:px-6">
          <Logo />
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 pb-32 pt-8 sm:px-6">
        <BrowserOnly fallback={<div className="h-96 animate-pulse rounded-2xl bg-surface" aria-busy="true" />}>
          <Onboarding />
        </BrowserOnly>
      </main>
    </div>
  );
}
