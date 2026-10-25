"use client";

import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { usePlanContext } from "@/components/app-shell/plan-context";
import { CourseSelect } from "@/components/schedule/course-select";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, NativeSelect } from "@/components/ui/form";
import { rawEntries, semesterHistory, type SemesterGpa } from "@/lib/gpa/forecast";
import type { GradingScale } from "@/lib/gpa/scales";
import { newId } from "@/lib/schedule/schema";
import { useAppStore } from "@/lib/state/store";
import { useGpa } from "./use-gpa";

export const SEMESTER_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);

/** SGPA bars with a CGPA line, for the semesters the student has assigned grades to. */
function TrendChart({ semesters, scale }: { semesters: SemesterGpa[]; scale: GradingScale }) {
  const w = 520;
  const h = 160;
  const pad = { l: 28, r: 8, t: 10, b: 22 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const x = (i: number) => pad.l + (innerW / semesters.length) * (i + 0.5);
  const y = (v: number) => pad.t + innerH - (v / scale.maxPoints) * innerH;
  const bar = Math.min(36, (innerW / semesters.length) * 0.5);
  const line = semesters.map((s, i) => (s.cgpaAfter === null ? null : `${x(i)},${y(s.cgpaAfter)}`)).filter(Boolean).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-label="Semester GPA and CGPA by semester">
      {[0, 1, 2, 3, 4].filter((v) => v <= scale.maxPoints).map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={w - pad.r} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth={1} />
          <text x={pad.l - 6} y={y(v) + 3} textAnchor="end" fontSize="10" fill="var(--text-dim)">
            {v.toFixed(1)}
          </text>
        </g>
      ))}
      {semesters.map((s, i) =>
        s.sgpa === null ? null : (
          <g key={s.semester}>
            <rect x={x(i) - bar / 2} y={y(s.sgpa)} width={bar} height={y(0) - y(s.sgpa)} rx={4} fill="var(--open)" opacity={0.55} />
            <text x={x(i)} y={h - 6} textAnchor="middle" fontSize="10.5" fill="var(--text-muted)">
              Sem {s.semester}
            </text>
          </g>
        ),
      )}
      {line && <polyline points={line} fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinejoin="round" />}
      {semesters.map((s, i) => (s.cgpaAfter === null ? null : <circle key={s.semester} cx={x(i)} cy={y(s.cgpaAfter)} r={3.5} fill="var(--accent)" />))}
    </svg>
  );
}

export function GpaHistoryCard() {
  const { scale, inputs, policy } = useGpa();
  if (!scale || !inputs) return null;
  const { semesters, unassigned } = semesterHistory(rawEntries(inputs), policy);
  return (
    <Card aria-labelledby="history-title">
      <CardHeader titleId="history-title" title="Semester by semester" description="Set the semester for each grade in the list above to see your semester GPA and trend." />
      <CardBody>
        {semesters.length === 0 ? (
          <p className="text-sm text-muted">No grades are assigned to a semester yet.</p>
        ) : (
          <>
            <TrendChart semesters={semesters} scale={scale} />
            <p className="mt-1 flex flex-wrap gap-4 text-[12px] text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-2.5 rounded-sm bg-open/60" /> Semester GPA
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="h-0.5 w-4 rounded bg-accent" /> CGPA after the semester
              </span>
            </p>
            <table className="mt-3 w-full text-sm">
              <caption className="sr-only">GPA by semester</caption>
              <thead>
                <tr className="text-left text-[12.5px] text-muted">
                  <th className="pb-1.5 font-medium">Semester</th>
                  <th className="pb-1.5 font-medium">Credits</th>
                  <th className="pb-1.5 text-right font-medium">Semester GPA</th>
                  <th className="pb-1.5 text-right font-medium">CGPA after</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {semesters.map((s) => (
                  <tr key={s.semester}>
                    <td className="py-1.5 text-fg">Semester {s.semester}</td>
                    <td className="num py-1.5 text-muted">{s.credits}</td>
                    <td className="num py-1.5 text-right text-fg">{s.sgpa?.toFixed(2) ?? "—"}</td>
                    <td className="num py-1.5 text-right text-fg">{s.cgpaAfter?.toFixed(2) ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        {unassigned > 0 && semesters.length > 0 && <p className="mt-2 text-[12.5px] text-muted">{unassigned} graded course{unassigned === 1 ? " has" : "s have"} no semester yet.</p>}
      </CardBody>
    </Card>
  );
}

/** Earlier attempts: failed courses and grades replaced by a retake. */
export function GpaAttemptsCard() {
  const plan = usePlanContext();
  const { scale, policy, result } = useGpa();
  const [form, setForm] = useState<{ code: string | null; grade: string; semester: string }>({ code: null, grade: "F", semester: "" });
  if (!scale || !result) return null;
  const attempts = plan.record.attempts;
  const options = [...scale.failingGrades, ...scale.passingGrades.filter((g) => g.points !== null)];
  return (
    <Card aria-labelledby="attempts-title">
      <CardHeader
        titleId="attempts-title"
        title="Failed and repeated courses"
        description={
          policy === "all"
            ? "Every attempt counts in your CGPA (your setting)."
            : "Only the latest attempt of a course counts (your setting)."
        }
        action={
          <Button asChild size="sm" variant="ghost">
            <Link href="/settings">Change</Link>
          </Button>
        }
      />
      <CardBody className="space-y-3">
        {attempts.length > 0 && (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {attempts.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate text-fg">{plan.index.byCode.get(a.code)?.title ?? a.code}</span>
                <span className="num text-muted">{a.grade}</span>
                <span className="text-[12.5px] text-muted">{a.semester ? `Sem ${a.semester}` : "—"}</span>
                <Button size="sm" variant="ghost" aria-label={`Remove attempt for ${a.code}`} onClick={() => useAppStore.getState().deleteAttempt(a.id)}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_100px_110px_auto] sm:items-end">
          <Field label="Course">{(id) => <CourseSelect id={id} value={form.code} onChange={(code) => setForm({ ...form, code })} />}</Field>
          <Field label="Grade">
            {(id) => (
              <NativeSelect id={id} value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })}>
                {options.map((g) => (
                  <option key={g.symbol} value={g.symbol}>
                    {g.label}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          <Field label="Semester">
            {(id) => (
              <NativeSelect id={id} value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })}>
                <option value="">—</option>
                {SEMESTER_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    Semester {n}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          <Button
            variant="secondary"
            disabled={!form.code}
            onClick={() => {
              useAppStore.getState().saveAttempt({ id: newId("attempt"), code: form.code!, grade: form.grade, semester: form.semester ? Number(form.semester) : null });
              setForm({ code: null, grade: "F", semester: "" });
            }}
          >
            <Plus /> Add attempt
          </Button>
        </div>
        <p className="text-[12.5px] text-muted">Record the grade you finally passed with in the list above; add earlier attempts here.</p>
      </CardBody>
    </Card>
  );
}
