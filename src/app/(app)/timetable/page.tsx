import type { Metadata } from "next";
import { TimetableScreen } from "@/components/schedule/timetable-screen";

// Rendered in the browser from locally saved data, so there is no server-rendered UI to validate for instant navigation.
export const instant = false;

export const metadata: Metadata = { title: "Timetable" };

export default function TimetablePage() {
  return <TimetableScreen />;
}
