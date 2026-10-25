"use client";

import { Lock, Plus } from "lucide-react";
import { useState } from "react";
import { usePlanContext } from "@/components/app-shell/plan-context";
import { lockedReason } from "@/components/courses/locked-reason";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { SearchInput } from "@/components/ui/field";
import { usePlanActions } from "./use-plan-actions";

/** Lets students add any course they're eligible for, and explains why locked ones can't be added. */
export function AddCourseDialog() {
  const plan = usePlanContext();
  const actions = usePlanActions();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const candidates = plan.curriculum.courses.filter((c) => {
    const s = plan.states.get(c.code)!;
    if (s.status === "completed" || s.status === "inprogress" || actions.currentIds.includes(c.code) || s.notNeeded) return false;
    return !q || c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q);
  });
  const sortKey = (code: string) => plan.index.byCode.get(code)!.recommendedSemester ?? 99;
  const available = candidates.filter((c) => plan.states.get(c.code)!.prereqMet).sort((a, b) => sortKey(a.code) - sortKey(b.code));
  const locked = candidates.filter((c) => !plan.states.get(c.code)!.prereqMet).sort((a, b) => sortKey(a.code) - sortKey(b.code));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <Plus /> Add a course
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Add a course to next semester"
        description={`You have ${actions.maxCredits - actions.currentCredits} of ${actions.maxCredits} credit hours left.`}
      >
        <SearchInput label="Search courses" placeholder="Search by name or code…" value={query} onChange={(e) => setQuery(e.target.value)} />

        <h3 className="mt-5 text-[12.5px] font-medium text-muted">Available now</h3>
        {available.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No other available courses match.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
            {available.map((c) => {
              const check = actions.canAdd(c.code);
              return (
                <li key={c.code} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-fg">{c.title}</p>
                    <p className="num text-[11.5px] text-dim">
                      {c.code} · {c.credits} cr · {plan.index.groupById.get(c.groupId)?.title}
                    </p>
                    {!check.ok && <p className="mt-0.5 text-[12.5px] text-warn">{check.description}</p>}
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      if (actions.add(c.code)) setOpen(false);
                    }}
                    aria-label={`Add ${c.title}`}
                  >
                    Add
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        <h3 className="mt-6 text-[12.5px] font-medium text-muted">Not available yet</h3>
        {locked.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nothing locked matches.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
            {locked.map((c) => (
              <li key={c.code} className="flex items-center gap-3 px-3 py-2.5">
                <Lock aria-hidden className="size-4 shrink-0 text-lock" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-muted">{c.title}</p>
                  <p className="text-[12.5px] text-dim">{lockedReason(plan.index, plan.states.get(c.code)!, plan.assumedEarnedCredits)}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => actions.add(c.code)} aria-label={`Why can't I add ${c.title}?`}>
                  Why?
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
