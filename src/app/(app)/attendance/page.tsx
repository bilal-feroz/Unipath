import type { Metadata } from "next";
import { AttendanceScreen } from "@/components/schedule/attendance-screen";

// Rendered in the browser from locally saved data, so there is no server-rendered UI to validate for instant navigation.
export const instant = false;

export const metadata: Metadata = { title: "Attendance" };

export default function AttendancePage() {
  return <AttendanceScreen />;
}
