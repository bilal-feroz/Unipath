import { CalendarRange, LayoutDashboard, ListChecks, Waypoints } from "lucide-react";

export const NAV_ITEMS = [
  { href: "/overview", label: "Overview", short: "Overview", n: "01", icon: LayoutDashboard },
  { href: "/courses", label: "My Courses", short: "Courses", n: "02", icon: ListChecks },
  { href: "/planner", label: "Semester Planner", short: "Planner", n: "03", icon: CalendarRange },
  { href: "/map", label: "Degree Map", short: "Map", n: "04", icon: Waypoints },
] as const;
