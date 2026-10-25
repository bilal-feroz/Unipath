"use client";

import { usePlanContext } from "@/components/app-shell/plan-context";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { CourseDetail } from "./course-detail";

/** Course details in a side panel (bottom sheet on phones). Selecting a linked course switches to it. */
export function CourseDetailDialog({ code, onChange }: { code: string | null; onChange: (code: string | null) => void }) {
  const plan = usePlanContext();
  const course = code ? plan.index.byCode.get(code) : null;
  return (
    <Dialog open={!!course} onOpenChange={(open) => !open && onChange(null)}>
      {course && (
        <DialogContent side="right" title={course.title}>
          <CourseDetail code={course.code} onSelectCourse={onChange} />
        </DialogContent>
      )}
    </Dialog>
  );
}
