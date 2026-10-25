import type { Metadata } from "next";
import { CampusScreen } from "@/components/schedule/campus-screen";

// Rendered in the browser from locally saved data, so there is no server-rendered UI to validate for instant navigation.
export const instant = false;

export const metadata: Metadata = { title: "CampusFlow" };

export default function CampusPage() {
  return <CampusScreen />;
}
