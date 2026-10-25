import type { Metadata } from "next";
import { GpaScreen } from "@/components/gpa/gpa-screen";

// Rendered in the browser from locally saved progress, so there is no server-rendered UI to validate for instant navigation.
export const instant = false;

export const metadata: Metadata = { title: "GPA" };

export default function GpaPage() {
  return <GpaScreen />;
}
