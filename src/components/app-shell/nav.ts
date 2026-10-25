import { CalendarRange, Gauge, LayoutDashboard, ListChecks, Sparkles, Waypoints } from "lucide-react";

export const NAV_ITEMS = [
  { href: "/overview", label: "Overview", short: "Overview", icon: LayoutDashboard },
  { href: "/courses", label: "My Courses", short: "Courses", icon: ListChecks },
  { href: "/planner", label: "Semester Planner", short: "Planner", icon: CalendarRange },
  { href: "/map", label: "Degree Map", short: "Map", icon: Waypoints },
  { href: "/gpa", label: "GPA", short: "GPA", icon: Gauge },
  { href: "/coach", label: "AI Coach", short: "Coach", icon: Sparkles },
] as const;
