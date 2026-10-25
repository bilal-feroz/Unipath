"use client";

import { Suspense, use, type ReactNode } from "react";
import { browser } from "react-dom";

function Gate({ children }: { children: ReactNode }) {
  // Saved progress lives in this browser's storage, so this part is rendered in the browser only.
  use(browser("UniPath reads saved progress from browser storage."));
  return children;
}

export function BrowserOnly({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  return (
    <Suspense fallback={fallback}>
      <Gate>{children}</Gate>
    </Suspense>
  );
}
