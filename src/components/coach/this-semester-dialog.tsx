"use client";

import { useState, type ReactElement } from "react";
import { usePlanContext } from "@/components/app-shell/plan-context";
import { StatusBadge } from "@/components/courses/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { SearchInput } from "@/components/ui/field";
import { useAppStore } from "@/lib/state/store";

/** Pick the courses being taken this semester. Changes save immediately. */
export function ThisSemesterDialog({ trigger }: { trigger: ReactElement }) {
  const plan = usePlanContext();
  const toggleInProgress = useAppStore((s) => s.toggleInProgress);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const rank = { inprogress: 0, planned: 1, eligible: 2, locked: 3, completed: 4 } as const;
  const courses = plan.curriculum.courses
    .filter((c) => !plan.completed.has(c.code))
    .filter((c) => !q || c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q))
    .sort(
      (a, b) =>
        rank[plan.states.get(a.code)!.status] - rank[plan.states.get(b.code)!.status] ||
        (a.recommendedSemester ?? 99) - (b.recommendedSemester ?? 99),
    );

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        title="What are you taking this semester?"
        description="Tick your current courses. UniPath plans next semester as if you pass them."
        footer={
          <DialogClose asChild>
            <Button>Done</Button>
          </DialogClose>
        }
      >
        <SearchInput label="Search courses" placeholder="Search by name or code…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
          {courses.map((c) => {
            const state = plan.states.get(c.code)!;
            const checked = state.status === "inprogress";
            return (
              <li key={c.code}>
                <label className="flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2 hover:bg-surface-2/40">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleInProgress(c.code)}
                    className="size-[18px] shrink-0 accent-[var(--now)]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-fg">{c.title}</span>
                    <span className="num block text-[11px] text-dim">{c.code}</span>
                  </span>
                  <StatusBadge status={state.status} compact />
                </label>
              </li>
            );
          })}
          {courses.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">No courses match.</li>}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
