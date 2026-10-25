"use client";

import { Field, Input, NativeSelect } from "@/components/ui/form";
import type { AttendanceRule } from "@/lib/schedule/schema";

/** Edits an attendance rule. The student enters their university's rule; nothing is assumed. */
export function AttendanceRuleFields({
  rule,
  onChange,
  allowInherit,
  inherit,
  onInherit,
}: {
  rule: AttendanceRule;
  onChange: (rule: AttendanceRule) => void;
  allowInherit?: boolean;
  inherit?: boolean;
  onInherit?: (inherit: boolean) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
      <Field label="Rule">
        {(id) => (
          <NativeSelect
            id={id}
            value={allowInherit && inherit ? "inherit" : rule.rule}
            onChange={(e) => {
              if (e.target.value === "inherit") return onInherit?.(true);
              onInherit?.(false);
              onChange({ ...rule, rule: e.target.value as AttendanceRule["rule"] });
            }}
          >
            {allowInherit && <option value="inherit">Same as my general rule</option>}
            <option value="none">No rule (show percentages only)</option>
            <option value="max-absences">A maximum number of absences</option>
            <option value="min-percent">A minimum attendance percentage</option>
          </NativeSelect>
        )}
      </Field>
      {!(allowInherit && inherit) && rule.rule === "max-absences" && (
        <Field label="Max absences">
          {(id) => <Input id={id} type="number" min={0} max={100} value={rule.maxAbsences} onChange={(e) => onChange({ ...rule, maxAbsences: Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0))) })} />}
        </Field>
      )}
      {!(allowInherit && inherit) && rule.rule === "min-percent" && (
        <Field label="Minimum %">
          {(id) => <Input id={id} type="number" min={1} max={100} value={rule.minPercent} onChange={(e) => onChange({ ...rule, minPercent: Math.max(1, Math.min(100, Number(e.target.value) || 1)) })} />}
        </Field>
      )}
    </div>
  );
}
