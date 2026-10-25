import type { Metadata } from "next";
import { SettingsScreen } from "@/components/schedule/settings-screen";

// Rendered in the browser from locally saved data, so there is no server-rendered UI to validate for instant navigation.
export const instant = false;

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return <SettingsScreen />;
}
