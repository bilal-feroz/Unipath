import type { Metadata } from "next";
import { CoachScreen } from "@/components/coach/coach-screen";

// Rendered in the browser from locally saved progress, so there is no server-rendered UI to validate for instant navigation.
export const instant = false;

export const metadata: Metadata = { title: "AI Coach" };

export default function CoachPage() {
  return <CoachScreen />;
}
