"use client";

import {
  Background,
  BackgroundVariant,
  BaseEdge,
  Controls,
  getBezierPath,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { List, Network, X } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/app-shell/app-shell";
import { usePlanContext } from "@/components/app-shell/plan-context";
import { CourseDetailDialog } from "@/components/courses/course-detail-dialog";
import { STATUS_META, STATUS_ORDER, StatusBadge } from "@/components/courses/status-badge";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import type { CourseStatus } from "@/lib/engine";
import { cn, plural } from "@/lib/utils";
import { layoutDegreeMap, lineage, NODE_H, NODE_W, smoothPath, type Point } from "./layout";
import { MapListView } from "./map-list-view";

type Filter = "all" | "completed" | "available" | "remaining";

interface CourseNodeData extends Record<string, unknown> {
  title: string;
  status: CourseStatus;
  dimmed: boolean;
  selected: boolean;
}

function CourseNode({ data }: NodeProps<Node<CourseNodeData>>) {
  const meta = STATUS_META[data.status];
  const Icon = meta.icon;
  return (
    <>
      <Handle type="target" position={Position.Left} className="!size-1 !min-h-0 !min-w-0 !border-0 !opacity-0" />
      {/* Clicks (mouse, or Enter/Space on this button) bubble to the map's onNodeClick handler. */}
      <button
        type="button"
        aria-pressed={data.selected}
        style={{ width: NODE_W, height: NODE_H, background: `linear-gradient(${meta.tint}, ${meta.tint}), var(--surface-solid)` }}
        className={cn(
          "flex items-center gap-2 rounded-lg border px-2.5 text-left transition-opacity duration-150",
          meta.border,
          data.selected && "ring-2 ring-accent ring-offset-2 ring-offset-bg",
          data.dimmed && "opacity-25",
        )}
      >
        <Icon aria-hidden className={cn("size-4 shrink-0", meta.text)} />
        <span
          className={cn(
            "line-clamp-2 text-[13px] font-medium leading-snug",
            data.status === "locked" ? "text-muted" : "text-fg",
          )}
        >
          {data.title}
          <span className="sr-only">, {meta.label}</span>
        </span>
      </button>
      <Handle type="source" position={Position.Right} className="!size-1 !min-h-0 !min-w-0 !border-0 !opacity-0" />
    </>
  );
}

const nodeTypes = { course: CourseNode };

type RoutedEdge = Edge<{ waypoints: Point[] }, "routed">;

/**
 * Links between neighbouring columns are simple curves. Links that skip columns follow the layout's
 * route around the courses in between, leaving and entering each course horizontally.
 */
function RoutedEdgeView(props: EdgeProps<RoutedEdge>) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, style, markerEnd } = props;
  const waypoints = data?.waypoints ?? [];
  const path =
    waypoints.length <= 1
      ? getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })[0]
      : smoothPath([
          { x: sourceX, y: sourceY },
          { x: sourceX + 24, y: sourceY },
          ...waypoints,
          { x: targetX - 24, y: targetY },
          { x: targetX, y: targetY },
        ]);
  return <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} />;
}

const edgeTypes = { routed: RoutedEdgeView };

function matchesFilter(status: CourseStatus, filter: Filter) {
  if (filter === "all") return true;
  if (filter === "completed") return status === "completed";
  if (filter === "available") return status === "eligible" || status === "planned";
  return status !== "completed";
}

function Legend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-muted" aria-label="Map key">
      {STATUS_ORDER.map((s) => (
        <li key={s} className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-full" style={{ background: STATUS_META[s].color }} />
          {STATUS_META[s].label}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <svg width="20" height="6" aria-hidden>
          <line x1="0" y1="3" x2="20" y2="3" stroke="var(--text-muted)" strokeDasharray="4 3" strokeWidth="1.5" />
        </svg>
        One of several options
      </li>
    </ul>
  );
}

function GraphView({ onOpenCourse }: { onOpenCourse: (code: string) => void }) {
  const plan = usePlanContext();
  const flow = useReactFlow();
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const layout = useMemo(() => layoutDegreeMap(plan.index), [plan.index]);
  // A tapped course stays highlighted; otherwise the one under the pointer is.
  const focus = selected ?? hovered;
  const family = useMemo(() => (focus ? lineage(layout.edges, focus) : null), [layout, focus]);
  // Open the map on where the student is now (the courses they can take next), at a readable size.
  const [initialFocus] = useState(() => {
    const frontier = [...plan.states.values()]
      .filter((s) => (s.status === "planned" || s.status === "eligible") && !s.notNeeded && layout.positions.has(s.code))
      .map((s) => ({ id: s.code }));
    return frontier.length >= 2 ? frontier : [...layout.positions.keys()].map((id) => ({ id }));
  });

  const nodes: Node<CourseNodeData>[] = useMemo(
    () =>
      [...layout.positions].map(([code, position]) => {
        const status = plan.states.get(code)!.status;
        const inFamily = !family || code === focus || family.up.has(code) || family.down.has(code);
        return {
          id: code,
          type: "course",
          position,
          // Fixed size, so the minimap can draw nodes without waiting for measurements.
          width: NODE_W,
          height: NODE_H,
          data: {
            title: plan.index.byCode.get(code)!.title,
            status,
            selected: code === selected,
            dimmed: !inFamily || !matchesFilter(status, filter),
          },
          draggable: false,
          selectable: false,
          focusable: false,
        };
      }),
    [plan, layout, family, focus, selected, filter],
  );

  const edges: RoutedEdge[] = useMemo(
    () =>
      layout.edges.map((e) => {
        const onPath =
          !!family &&
          (((e.target === focus || family.up.has(e.target)) && family.up.has(e.source)) ||
            ((e.source === focus || family.down.has(e.source)) && family.down.has(e.target)));
        const sourceDone = plan.completed.has(e.source);
        const color = onPath ? "var(--accent)" : sourceDone ? "var(--done)" : "var(--text-dim)";
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          type: "routed",
          data: { waypoints: e.waypoints },
          style: {
            stroke: color,
            strokeWidth: onPath ? 2.2 : 1.2,
            strokeDasharray: e.alternative ? "5 4" : undefined,
            opacity: family ? (onPath ? 1 : 0.07) : 0.45,
            transition: "opacity 150ms",
          },
          markerEnd: { type: MarkerType.ArrowClosed, color, width: 12, height: 12 },
          zIndex: onPath ? 1 : 0,
          focusable: false,
        };
      }),
    [layout, family, focus, plan.completed],
  );

  const focusCourse = (code: string) => {
    setQuery("");
    const p = layout.positions.get(code);
    if (!p) {
      // Not on the map (no prerequisite links): show its details instead.
      onOpenCourse(code);
      return;
    }
    setSelected(code);
    flow.setCenter(p.x + NODE_W / 2, p.y + NODE_H / 2, { zoom: 1.1, duration: 500 });
  };

  const q = query.trim().toLowerCase();
  const matches = q
    ? plan.curriculum.courses.filter((c) => c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q)).slice(0, 6)
    : [];
  const selectedCourse = selected ? plan.index.byCode.get(selected) : null;
  const selectedFamily = selected ? lineage(layout.edges, selected) : null;

  return (
    <>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative md:w-80">
          <SearchInput
            label="Find a course on the map"
            placeholder="Find a course…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && matches[0]) focusCourse(matches[0].code);
            }}
          />
          {matches.length > 0 && (
            <ul className="glass-pop absolute inset-x-0 top-11 z-20 overflow-hidden rounded-xl border border-line-strong">
              {matches.map((c) => (
                <li key={c.code}>
                  <button
                    type="button"
                    onClick={() => focusCourse(c.code)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-surface-2"
                  >
                    <span className="num w-16 shrink-0 text-xs text-dim">{c.code}</span>
                    <span className="truncate">{c.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Segmented
          label="Show courses"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "completed", label: "Completed" },
            { value: "available", label: "Available" },
            { value: "remaining", label: "Remaining" },
          ]}
        />
      </div>

      <div className="mt-4">
        <Legend />
      </div>

      <div className="glass relative mt-3 h-[68vh] min-h-[460px] overflow-hidden rounded-2xl border border-line">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.2, nodes: initialFocus, minZoom: 0.75, maxZoom: 1 }}
          minZoom={0.2}
          maxZoom={1.8}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          onNodeClick={(_, node) => setSelected((cur) => (cur === node.id ? null : node.id))}
          onNodeMouseEnter={(_, node) => setHovered(node.id)}
          onNodeMouseLeave={() => setHovered(null)}
          onPaneClick={() => setSelected(null)}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="var(--border)" />
          <Controls showInteractive={false} position="bottom-right" />
          <MiniMap
            position="top-right"
            pannable
            zoomable
            ariaLabel="Overview of the whole map"
            nodeColor={(n) => STATUS_META[(n.data as CourseNodeData).status]?.color ?? "var(--lock)"}
            nodeBorderRadius={6}
            className="!hidden md:!block"
            style={{ width: 168, height: 104 }}
          />
        </ReactFlow>

        {selectedCourse && selectedFamily && (
          <div
            role="status"
            className="glass-pop absolute inset-x-3 bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-line-strong p-3 md:right-auto md:max-w-xl"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-fg">{selectedCourse.title}</p>
              <p className="text-[12.5px] text-muted">
                Needs {plural(selectedFamily.up.size, "course")} first · leads to{" "}
                {plural(selectedFamily.down.size, "later course")}
              </p>
            </div>
            <StatusBadge status={plan.states.get(selectedCourse.code)!.status} />
            <Button size="sm" onClick={() => onOpenCourse(selectedCourse.code)}>
              Open details
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(null)} aria-label="Clear highlight">
              <X />
            </Button>
          </div>
        )}
      </div>
      <p className="mt-2 text-[13px] text-muted">
        Point at or tap a course to trace what it needs and what it unlocks.
        {layout.standalone.length > 0 &&
          ` ${plural(layout.standalone.length, "course")} with no prerequisite links ${layout.standalone.length === 1 ? "is" : "are"} only in the list.`}
      </p>
    </>
  );
}

export function MapScreen() {
  const [view, setView] = useState<"map" | "list">(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches ? "list" : "map",
  );
  const [openCode, setOpenCode] = useState<string | null>(null);

  return (
    <div className="page-in mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Degree map"
        description="Which courses lead to which."
        action={
          <div role="group" aria-label="View" className="inline-flex gap-1 rounded-[11px] border border-line bg-bg/60 p-1">
            {(
              [
                { v: "map", label: "Map", icon: Network },
                { v: "list", label: "List", icon: List },
              ] as const
            ).map(({ v, label, icon: Icon }) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px]",
                  view === v ? "bg-accent font-semibold text-accent-fg" : "text-muted hover:text-fg",
                )}
              >
                <Icon aria-hidden className="size-4" /> {label}
              </button>
            ))}
          </div>
        }
      />
      <div className="mt-6">
        {view === "map" ? (
          <ReactFlowProvider>
            <GraphView onOpenCourse={setOpenCode} />
          </ReactFlowProvider>
        ) : (
          <MapListView onOpenCourse={setOpenCode} />
        )}
      </div>
      <CourseDetailDialog code={openCode} onChange={setOpenCode} />
    </div>
  );
}
