import { CalendarRange, Gauge, LayoutDashboard, ListChecks, Sparkles, Waypoints } from "lucide-react";

export const NAV_ITEMS = [
  { href: "/overview", label: "Overview", short: "Overview", n: "01", icon: LayoutDashboard },
  { href: "/courses", label: "My Courses", short: "Courses", n: "02", icon: ListChecks },
  { href: "/planner", label: "Semester Planner", short: "Planner", n: "03", icon: CalendarRange },
  { href: "/map", label: "Degree Map", short: "Map", n: "04", icon: Waypoints },
  { href: "/gpa", label: "GPA", short: "GPA", n: "05", icon: Gauge },
  { href: "/coach", label: "AI Coach", short: "Coach", n: "06", icon: Sparkles },
] as const;
