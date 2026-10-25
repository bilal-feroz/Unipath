/**
 * Verified campus maps, per university. A campus is only listed here when its buildings (and, later,
 * floor plans and walking routes) come from an official source. Until then CampusFlow works from the
 * rooms in the student's own timetable and never estimates walking times.
 */

export interface CampusBuilding {
  id: string;
  name: string;
  /** Short code as printed on signs, e.g. "B". */
  code?: string;
  /** For directions links, from an official map. */
  lat?: number;
  lng?: number;
  floors?: string[];
}

export interface CampusMap {
  universityId: string;
  verified: boolean;
  buildings: CampusBuilding[];
  source?: { title: string; url: string; retrieved: string };
}

const CAMPUSES: CampusMap[] = [
  // Al Ain University: no verified building list or routes have been transcribed yet.
  { universityId: "aau", verified: false, buildings: [] },
];

export function campusFor(universityId: string): CampusMap | null {
  return CAMPUSES.find((c) => c.universityId === universityId) ?? null;
}

export function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
