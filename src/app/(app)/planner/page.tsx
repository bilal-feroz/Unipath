import type { Metadata } from "next";
import { PlannerScreen } from "@/components/planner/planner-screen";

// Rendered in the browser from locally saved progress, so there is no server-rendered UI to validate for instant navigation.
export const instant = false;

export const metadata: Metadata = { title: "Semester Planner" };

export default function PlannerPage() {
  return <PlannerScreen />;
}
