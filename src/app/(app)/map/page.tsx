import type { Metadata } from "next";
import { MapScreen } from "@/components/map/map-screen";

// Rendered in the browser from locally saved progress, so there is no server-rendered UI to validate for instant navigation.
export const instant = false;

export const metadata: Metadata = { title: "Degree Map" };

export default function MapPage() {
  return <MapScreen />;
}
