import type { Metadata } from "next";
import { BrowserOnly } from "@/components/browser-only";
import { EnterDemo } from "@/components/landing/enter-demo";

export const metadata: Metadata = { title: "Demo" };

export default function DemoPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4" aria-busy="true">
      <p className="text-muted">Loading the sample student…</p>
      <BrowserOnly fallback={null}>
        <EnterDemo />
      </BrowserOnly>
    </main>
  );
}
