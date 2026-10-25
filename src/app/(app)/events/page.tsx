import type { Metadata } from "next";
import { EventsScreen } from "@/components/schedule/events-screen";

// Rendered in the browser from locally saved data, so there is no server-rendered UI to validate for instant navigation.
export const instant = false;

export const metadata: Metadata = { title: "University events" };

export default function EventsPage() {
  return <EventsScreen />;
}
