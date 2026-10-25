import dagre from "@dagrejs/dagre";
import type { PrereqExpr } from "@/lib/curriculum/types";
import type { CurriculumIndex } from "@/lib/engine";

export const NODE_W = 212;
export const NODE_H = 66;

export interface MapEdge {
  id: string;
  source: string;
  target: string;
  /** Part of an "any one of" rule, so not strictly required. */
  alternative: boolean;
}

export interface MapLayout {
  positions: Map<string, { x: number; y: number }>;
  edges: MapEdge[];
  standalone: string[];
  standaloneLabelY: number;
}

function collectEdges(expr: PrereqExpr | null, target: string, alternative: boolean, out: MapEdge[]) {
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
 * Lays out the prerequisite graph left-to-right with dagre (layered layout that minimises crossings).
 * Courses with no prerequisite links are placed in a tidy grid underneath instead of piling up in one column.
 */
export function layoutDegreeMap(index: CurriculumIndex): MapLayout {
  const edges: MapEdge[] = [];
  for (const course of index.curriculum.courses) collectEdges(course.prerequisite, course.code, false, edges);
  const valid = edges.filter((e) => index.byCode.has(e.source) && index.byCode.has(e.target));
  const linked = new Set(valid.flatMap((e) => [e.source, e.target]));

  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", nodesep: 22, ranksep: 90, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));
  // Insert in suggested-semester order so the layout follows the official sequence where it can.
  const ordered = [...index.curriculum.courses].sort(
    (a, b) => (a.recommendedSemester ?? 99) - (b.recommendedSemester ?? 99) || a.code.localeCompare(b.code),
  );
  for (const c of ordered) if (linked.has(c.code)) g.setNode(c.code, { width: NODE_W, height: NODE_H });
  for (const e of valid) g.setEdge(e.source, e.target);
  dagre.layout(g);

  const positions = new Map<string, { x: number; y: number }>();
  let maxY = 0;
  for (const code of linked) {
    const n = g.node(code);
    positions.set(code, { x: n.x - NODE_W / 2, y: n.y - NODE_H / 2 });
    maxY = Math.max(maxY, n.y + NODE_H / 2);
  }

  const standalone = ordered.filter((c) => !linked.has(c.code)).map((c) => c.code);
  const cols = 6;
  const startY = maxY + 110;
  standalone.forEach((code, i) => {
    positions.set(code, {
      x: 20 + (i % cols) * (NODE_W + 22),
      y: startY + Math.floor(i / cols) * (NODE_H + 22),
    });
  });

  return { positions, edges: valid, standalone, standaloneLabelY: startY - 46 };
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
