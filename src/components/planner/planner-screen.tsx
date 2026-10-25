"use client";

import { Tabs } from "radix-ui";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell/app-shell";
import { CourseDetailDialog } from "@/components/courses/course-detail-dialog";
import { NextSemester } from "./next-semester";
import { RoadmapView } from "./roadmap-view";
import { WhatIf } from "./what-if";

const TABS = [
  { value: "next", label: "Next semester" },
  { value: "roadmap", label: "Roadmap" },
  { value: "what-if", label: "What if?" },
] as const;
type Tab = (typeof TABS)[number]["value"];

function initialTab(): Tab {
  if (typeof window === "undefined") return "next";
  const hash = window.location.hash.replace("#", "");
  return (TABS.some((t) => t.value === hash) ? hash : "next") as Tab;
}

export function PlannerScreen() {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [openCode, setOpenCode] = useState<string | null>(null);

  // Links like /planner#roadmap should open that tab, including when Next.js re-shows this page
  // from its preserved state (effects re-run when the page becomes visible again).
  useEffect(() => {
    const sync = () => {
      if (window.location.hash) setTab(initialTab());
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  return (
    <div className="page-in mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow="03 · Semester Planner"
        title="Plan your semesters"
        description="A recommended next semester, your full roadmap to graduation, and a safe place to try “what if?”."
      />
      <Tabs.Root
        value={tab}
        onValueChange={(v) => {
          setTab(v as Tab);
          history.replaceState(null, "", `#${v}`);
        }}
        className="mt-6"
      >
        <Tabs.List aria-label="Planner views" className="flex gap-1 border-b border-line">
          {TABS.map((t) => (
            <Tabs.Trigger
              key={t.value}
              value={t.value}
              className="relative -mb-px h-11 border-b-2 border-transparent px-4 text-sm text-muted transition-colors hover:text-fg data-[state=active]:border-accent data-[state=active]:font-semibold data-[state=active]:text-fg"
            >
              {t.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <Tabs.Content value="next" className="pt-6 focus:outline-none">
          <NextSemester onOpenCourse={setOpenCode} />
        </Tabs.Content>
        <Tabs.Content value="roadmap" className="pt-6 focus:outline-none">
          <RoadmapView onOpenCourse={setOpenCode} />
        </Tabs.Content>
        <Tabs.Content value="what-if" className="pt-6 focus:outline-none">
          <WhatIf />
        </Tabs.Content>
      </Tabs.Root>
      <CourseDetailDialog code={openCode} onChange={setOpenCode} />
    </div>
  );
}
