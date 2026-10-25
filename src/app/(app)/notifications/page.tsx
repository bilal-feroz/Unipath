import type { Metadata } from "next";
import { NotificationsScreen } from "@/components/schedule/notifications-screen";

// Rendered in the browser from locally saved data, so there is no server-rendered UI to validate for instant navigation.
export const instant = false;

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return <NotificationsScreen />;
}
