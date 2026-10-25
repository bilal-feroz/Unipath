import {
  CalendarDays,
  CalendarRange,
  Clock,
  Compass,
  Gauge,
  GraduationCap,
  House,
  ListChecks,
  ListTodo,
  MapPin,
  PartyPopper,
  Sparkles,
  UserCheck,
  Waypoints,
} from "lucide-react";

export interface NavItem {
  href: string;
  /** Full name (also what screen readers hear). */
  label: string;
  /** Short name for tight spaces. */
  short: string;
  icon: typeof House;
}

export interface NavGroup {
  id: string;
  label: string;
  short: string;
  icon: typeof House;
  /** A group with one destination is a plain link. */
  href?: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  { id: "home", label: "Home", short: "Home", icon: House, href: "/overview", items: [] },
  {
    id: "academics",
    label: "Academics",
    short: "Academics",
    icon: GraduationCap,
    items: [
      { href: "/courses", label: "My Courses", short: "Courses", icon: ListChecks },
      { href: "/planner", label: "Semester Planner", short: "Planner", icon: CalendarRange },
      { href: "/map", label: "Degree Map", short: "Map", icon: Waypoints },
      { href: "/gpa", label: "GPA and forecast", short: "GPA", icon: Gauge },
    ],
  },
  {
    id: "schedule",
    label: "Schedule",
    short: "Schedule",
    icon: CalendarDays,
    items: [
      { href: "/timetable", label: "Timetable", short: "Timetable", icon: Clock },
      { href: "/calendar", label: "Calendar", short: "Calendar", icon: CalendarDays },
      { href: "/tasks", label: "Assignments and exams", short: "Tasks", icon: ListTodo },
    ],
  },
  {
    id: "campus",
    label: "Campus",
    short: "Campus",
    icon: MapPin,
    items: [
      { href: "/campus", label: "CampusFlow", short: "CampusFlow", icon: Compass },
      { href: "/events", label: "University events", short: "Events", icon: PartyPopper },
    ],
  },
  { id: "attendance", label: "Attendance", short: "Attendance", icon: UserCheck, href: "/attendance", items: [] },
  { id: "coach", label: "AI Coach", short: "Coach", icon: Sparkles, href: "/coach", items: [] },
];

/** The bottom bar on phones and tablets; everything is also under "More". */
export const MOBILE_TABS: NavItem[] = [
  { href: "/overview", label: "Home", short: "Home", icon: House },
  { href: "/calendar", label: "Calendar", short: "Calendar", icon: CalendarDays },
  { href: "/tasks", label: "Assignments and exams", short: "Tasks", icon: ListTodo },
  { href: "/courses", label: "My Courses", short: "Courses", icon: ListChecks },
];

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function groupIsActive(pathname: string, group: NavGroup): boolean {
  return group.href ? isActive(pathname, group.href) : group.items.some((i) => isActive(pathname, i.href));
}
