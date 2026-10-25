import type { Metadata } from "next";
import { CoursesScreen } from "@/components/courses/courses-screen";

// Rendered in the browser from locally saved progress, so there is no server-rendered UI to validate for instant navigation.
export const instant = false;

export const metadata: Metadata = { title: "My Courses" };

export default function CoursesPage() {
  return <CoursesScreen />;
}
