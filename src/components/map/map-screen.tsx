"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
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
import { layoutDegreeMap, lineage, NODE_H, NODE_W } from "./layout";
import { MapListView } from "./map-list-view";

type Filter = "all" | "completed" | "available" | "remaining";

interface CourseNodeData extends Record<string, unknown> {
  code: string;
  title: string;
  credits: number;
  status: CourseStatus;
  dimmed: boolean;
  selected: boolean;
}


function CourseNode({ data }: NodeProps<Node<CourseNodeData>>) {
  const meta = STATUS_META[data.status];
  const Icon = meta.icon;
  return (
    <>
      <Handle type="target" position={Position.Left} className="!size-1.5 !border-0 !bg-line-strong" />
      {/* Clicks (mouse, or Enter/Space on this button) bubble to the map's onNodeClick handler. */}
      <button
        type="button"
        aria-label={`${data.title}, ${meta.label}`}
        aria-pressed={data.selected}
        style={{
          width: NODE_W,
          height: NODE_H,
          background: `linear-gradient(${meta.tint}, ${meta.tint}), var(--surface)`,
          borderLeft: `3px solid ${meta.color}`,
        }}
        className={cn(
          "flex items-center gap-2.5 rounded-xl border px-3 text-left transition-opacity",
          meta.border,
          data.selected && "ring-2 ring-accent ring-offset-2 ring-offset-bg",
          data.dimmed && "opacity-25",
        )}
      >
        <Icon aria-hidden className={cn("size-4 shrink-0", meta.text)} />
        <span className="min-w-0 flex-1">
          <span className="num block text-[10px] text-dim">
            {data.code} · {data.credits} cr
          </span>
          <span className="line-clamp-2 block text-[12.5px] font-medium leading-tight text-fg">{data.title}</span>
        </span>
      </button>
      <Handle type="source" position={Position.Right} className="!size-1.5 !border-0 !bg-line-strong" />
    </>
  );
}

function LabelNode({ data }: NodeProps<Node<{ label: string }>>) {
  return <p className="num whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.12em] text-dim">{data.label}</p>;
}

const nodeTypes = { course: CourseNode, label: LabelNode };

function matchesFilter(status: CourseStatus, filter: Filter) {
  if (filter === "all") return true;
  if (filter === "completed") return status === "completed";
  if (filter === "available") return status === "eligible" || status === "planned";
  return status !== "completed";
}

function GraphView({ onOpenCourse }: { onOpenCourse: (code: string) => void }) {
  const plan = usePlanContext();
  const flow = useReactFlow();
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const layout = useMemo(() => layoutDegreeMap(plan.index), [plan.index]);
  const family = useMemo(() => (selected ? lineage(layout.edges, selected) : null), [layout, selected]);
  // Open the map zoomed on where the student is now: the courses they can take next.
  const [initialFocus] = useState(() => {
    const linked = new Set(layout.edges.flatMap((e) => [e.source, e.target]));
    const frontier = [...plan.states.values()]
      .filter((s) => (s.status === "planned" || s.status === "eligible") && !s.notNeeded && linked.has(s.code))
      .map((s) => ({ id: s.code }));
    return frontier.length >= 2 ? frontier : [...linked].map((id) => ({ id }));
  });

  const nodes: Node[] = useMemo(() => {
    const courseNodes: Node<CourseNodeData>[] = plan.curriculum.courses.map((c) => {
      const status = plan.states.get(c.code)!.status;
      const inFamily = !family || c.code === selected || family.up.has(c.code) || family.down.has(c.code);
      return {
        id: c.code,
        type: "course",
        position: layout.positions.get(c.code)!,
        data: {
          code: c.code,
          title: c.title,
          credits: c.credits,
          status,
          selected: c.code === selected,
          dimmed: !inFamily || !matchesFilter(status, filter),
        },
        draggable: false,
        selectable: false,
        focusable: false,
      };
    });
    const label: Node = {
      id: "standalone-label",
      type: "label",
      position: { x: 20, y: layout.standaloneLabelY },
      data: { label: "Courses with no prerequisite links" },
      draggable: false,
      selectable: false,
      focusable: false,
    };
    return layout.standalone.length ? [...courseNodes, label] : courseNodes;
  }, [plan, layout, family, selected, filter]);

  const edges: Edge[] = useMemo(
    () =>
      layout.edges.map((e) => {
        const onPath =
          !!family &&
          (((e.target === selected || family.up.has(e.target)) && family.up.has(e.source)) ||
            ((e.source === selected || family.down.has(e.source)) && family.down.has(e.target)));
        const sourceDone = plan.completed.has(e.source);
        const color = onPath ? "var(--accent)" : sourceDone ? "var(--done)" : "var(--border-strong)";
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          type: "smoothstep",
          animated: onPath,
          style: {
            stroke: color,
            strokeWidth: onPath ? 2 : 1.3,
            strokeDasharray: e.alternative ? "5 4" : undefined,
            opacity: family && !onPath ? 0.15 : 1,
          },
          markerEnd: { type: MarkerType.ArrowClosed, color, width: 14, height: 14 },
          focusable: false,
        };
      }),
    [layout, family, selected, plan.completed],
  );

  const focusCourse = (code: string) => {
    setSelected(code);
    setQuery("");
    const p = layout.positions.get(code);
    if (p) flow.setCenter(p.x + NODE_W / 2, p.y + NODE_H / 2, { zoom: 1.1, duration: 500 });
  };

  const q = query.trim().toLowerCase();
  const matches = q
    ? plan.curriculum.courses.filter((c) => c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q)).slice(0, 6)
    : [];
  const selectedCourse = selected ? plan.index.byCode.get(selected) : null;

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
            <ul className="absolute inset-x-0 top-11 z-20 overflow-hidden rounded-xl border border-line bg-bg-elev shadow-2xl">
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

      <div className="relative mt-3 h-[68vh] min-h-[460px] overflow-hidden rounded-2xl border border-line bg-bg-elev">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15, nodes: initialFocus, maxZoom: 1 }}
          minZoom={0.15}
          maxZoom={1.8}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          onNodeClick={(_, node) => {
            if (node.type === "course") setSelected((cur) => (cur === node.id ? null : node.id));
          }}
          onPaneClick={() => setSelected(null)}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="var(--border)" />
          <Controls showInteractive={false} position="bottom-right" />
        </ReactFlow>

        <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-1.5">
          {STATUS_ORDER.map((s) => (
            <StatusBadge key={s} status={s} className="bg-bg-elev/90" />
          ))}
          <span className="inline-flex h-6 items-center gap-1.5 rounded-md border border-line bg-bg-elev/90 px-2 text-[12px] text-muted">
            <svg width="22" height="6" aria-hidden>
              <line x1="0" y1="3" x2="22" y2="3" stroke="var(--text-muted)" strokeDasharray="4 3" strokeWidth="1.5" />
            </svg>
            One of several options
          </span>
        </div>

        {selectedCourse && family && (
          <div
            role="status"
            className="absolute inset-x-3 bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-line-strong bg-bg-elev/95 p-3 shadow-2xl backdrop-blur md:right-auto md:max-w-xl"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-fg">{selectedCourse.title}</p>
              <p className="text-[12.5px] text-muted">
                Needs {plural(family.up.size, "course")} first · leads to {plural(family.down.size, "later course")}
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
        Arrows point from a course to the courses it unlocks. Select a course to highlight everything before and after it.
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
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow="04 · Degree Map"
        title="How your courses connect"
        description="See which courses lead to which, and what's blocking what."
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
