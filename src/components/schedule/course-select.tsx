"use client";

import { usePlanContext } from "@/components/app-shell/plan-context";
import { NativeSelect } from "@/components/ui/form";
import type { ComponentProps } from "react";

/** Courses from the student's plan, with the ones they're taking this semester first. */
export function CourseSelect({
  value,
  onChange,
  allowNone,
  ...props
}: Omit<ComponentProps<"select">, "value" | "onChange"> & {
  value: string | null;
  onChange: (code: string | null) => void;
  allowNone?: string;
}) {
  const plan = usePlanContext();
  const taking = [...plan.inProgress].map((c) => plan.index.byCode.get(c)!).filter(Boolean);
  const others = plan.curriculum.courses.filter((c) => !plan.inProgress.has(c.code)).sort((a, b) => a.title.localeCompare(b.title));
  return (
    <NativeSelect value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} {...props}>
      {allowNone !== undefined ? <option value="">{allowNone}</option> : <option value="" disabled>Choose a course…</option>}
      {taking.length > 0 && (
        <optgroup label="Taking this semester">
          {taking.map((c) => (
            <option key={c.code} value={c.code}>
              {c.title} ({c.code})
            </option>
          ))}
        </optgroup>
      )}
      <optgroup label={taking.length > 0 ? "Other courses in your plan" : "Courses in your plan"}>
        {others.map((c) => (
          <option key={c.code} value={c.code}>
            {c.title} ({c.code})
          </option>
        ))}
      </optgroup>
    </NativeSelect>
  );
}
