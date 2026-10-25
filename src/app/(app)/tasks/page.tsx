import type { Metadata } from "next";
import { TasksScreen } from "@/components/schedule/tasks-screen";

// Rendered in the browser from locally saved data, so there is no server-rendered UI to validate for instant navigation.
export const instant = false;

export const metadata: Metadata = { title: "Assignments and exams" };

export default function TasksPage() {
  return <TasksScreen />;
}
