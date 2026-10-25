import dagre from "@dagrejs/dagre";
import type { PrereqExpr } from "@/lib/curriculum/types";
import type { CurriculumIndex } from "@/lib/engine";

export const NODE_W = 200;
export const NODE_H = 52;

export interface Point {
  x: number;
  y: number;
}

export interface MapEdge {
  id: string;
  source: string;
  target: string;
  /** Part of an "any one of" rule, so not strictly required. */
  alternative: boolean;
  /** Where the line bends to go around other courses (from the layout), between the two ends. */
  waypoints: Point[];
}

export interface MapLayout {
  positions: Map<string, Point>;
  edges: MapEdge[];
  /** Courses with no prerequisite links at all. They're left off the map (the list view has them). */
  standalone: string[];
}

function collectEdges(expr: PrereqExpr | null, target: string, alternative: boolean, out: Omit<MapEdge, "waypoints">[]) {
  if (!expr) return;
  switch (expr.kind) {
    case "course":
      out.push({ id: `${expr.code}->${target}`, source: expr.code, target, alternative });
      return;
    case "all":
      expr.items.forEach((i) => collectEdges(i, target, alternative, out));
      return;
    case "any":
      expr.items.forEach((i) => collectEdges(i, target, true, out));
      return;
  }
}

/**
 * Lays out the prerequisite graph left-to-right with dagre (a layered layout that minimises crossings).
 * Lines keep dagre's routing, so a line that skips a column bends around the courses in between
 * instead of crossing them.
 */
export function layoutDegreeMap(index: CurriculumIndex): MapLayout {
  const raw: Omit<MapEdge, "waypoints">[] = [];
  for (const course of index.curriculum.courses) collectEdges(course.prerequisite, course.code, false, raw);
  const seen = new Set<string>();
  const valid = raw.filter((e) => {
    if (!index.byCode.has(e.source) || !index.byCode.has(e.target) || seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
  const linked = new Set(valid.flatMap((e) => [e.source, e.target]));

  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", nodesep: 18, ranksep: 72, edgesep: 12, marginx: 24, marginy: 24 });
  g.setDefaultEdgeLabel(() => ({}));
  // Insert in suggested-semester order so the layout follows the official sequence where it can.
  const ordered = [...index.curriculum.courses].sort(
    (a, b) => (a.recommendedSemester ?? 99) - (b.recommendedSemester ?? 99) || a.code.localeCompare(b.code),
  );
  for (const c of ordered) if (linked.has(c.code)) g.setNode(c.code, { width: NODE_W, height: NODE_H });
  for (const e of valid) g.setEdge(e.source, e.target);
  dagre.layout(g);

  const positions = new Map<string, Point>();
  for (const code of linked) {
    const n = g.node(code);
    positions.set(code, { x: n.x - NODE_W / 2, y: n.y - NODE_H / 2 });
  }

  const edges: MapEdge[] = valid.map((e) => {
    const points: Point[] = g.edge(e.source, e.target)?.points ?? [];
    // The first and last points sit on the course boxes; the map draws those ends from its own handles.
    return { ...e, waypoints: points.slice(1, -1).map((p) => ({ x: p.x, y: p.y })) };
  });

  return { positions, edges, standalone: ordered.filter((c) => !linked.has(c.code)).map((c) => c.code) };
}

/** A smooth SVG path through the points (Catmull-Rom spline drawn as cubic Béziers). */
export function smoothPath(points: Point[]): string {
  if (points.length === 0) return "";
  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C ${c1.x},${c1.y} ${c2.x},${c2.y} ${p2.x},${p2.y}`;
  }
  return d;
}

/** All prerequisites (transitively) of a course, and all courses that depend on it. */
export function lineage(edges: MapEdge[], code: string) {
  const up = new Set<string>();
  const down = new Set<string>();
  const walk = (start: string, dir: "up" | "down", seen: Set<string>) => {
    const stack = [start];
    while (stack.length) {
      const cur = stack.pop()!;
      for (const e of edges) {
        const next = dir === "up" ? (e.target === cur ? e.source : null) : e.source === cur ? e.target : null;
        if (next && !seen.has(next)) {
          seen.add(next);
          stack.push(next);
        }
      }
    }
  };
  walk(code, "up", up);
  walk(code, "down", down);
  return { up, down };
}
