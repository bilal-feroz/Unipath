import { ADMIN_TYPES, EXAM_TYPES, type TaskType } from "@/lib/schedule/schema";
import type { AgendaItem } from "@/lib/schedule/agenda";

/** Calendar colour groups. Each uses an existing theme colour so both themes stay readable. */
export type ItemGroup = "class" | "deadline" | "exam" | "admin" | "event" | "study";

export const GROUP_META: Record<ItemGroup, { label: string; dot: string; chip: string; border: string }> = {
  class: { label: "Classes", dot: "bg-open", chip: "bg-open-soft text-fg", border: "border-l-open" },
  deadline: { label: "Deadlines", dot: "bg-plan", chip: "bg-plan-soft text-fg", border: "border-l-plan" },
  exam: { label: "Exams", dot: "bg-danger", chip: "bg-danger-soft text-fg", border: "border-l-danger" },
  admin: { label: "Admin", dot: "bg-warn", chip: "bg-warn-soft text-fg", border: "border-l-warn" },
  event: { label: "Events", dot: "bg-accent", chip: "bg-accent-soft text-fg", border: "border-l-accent" },
  study: { label: "Study & personal", dot: "bg-done", chip: "bg-done-soft text-fg", border: "border-l-done" },
};

export function taskGroup(type: TaskType): ItemGroup {
  if (EXAM_TYPES.has(type)) return "exam";
  if (ADMIN_TYPES.has(type)) return "admin";
  return "deadline";
}

export function itemGroup(item: AgendaItem): ItemGroup {
  if (item.kind === "class") return "class";
  if (item.kind === "task") return taskGroup(item.category as TaskType);
  if (item.category === "registration" || item.category === "admin") return "admin";
  if (item.category === "study" || item.category === "personal") return "study";
  return "event";
}
