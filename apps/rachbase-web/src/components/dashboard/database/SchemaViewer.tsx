"use client";

import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  BackgroundVariant,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { mockTables } from "@/data/mock/database";
import { Key, Hash, Rows3 } from "lucide-react";

// Column definitions per table for the ER diagram
const tableColumns: Record<string, { name: string; type: string; pk?: boolean; fk?: string }[]> = {
  users: [
    { name: "id", type: "uuid", pk: true },
    { name: "email", type: "varchar(255)" },
    { name: "name", type: "varchar(255)" },
    { name: "password_hash", type: "text" },
    { name: "role", type: "varchar(50)" },
    { name: "created_at", type: "timestamptz" },
  ],
  products: [
    { name: "id", type: "uuid", pk: true },
    { name: "name", type: "varchar(255)" },
    { name: "price", type: "decimal(10,2)" },
    { name: "category_id", type: "uuid", fk: "categories" },
    { name: "description", type: "text" },
    { name: "created_at", type: "timestamptz" },
  ],
  orders: [
    { name: "id", type: "uuid", pk: true },
    { name: "user_id", type: "uuid", fk: "users" },
    { name: "total", type: "decimal(10,2)" },
    { name: "status", type: "varchar(50)" },
    { name: "created_at", type: "timestamptz" },
  ],
  order_items: [
    { name: "id", type: "uuid", pk: true },
    { name: "order_id", type: "uuid", fk: "orders" },
    { name: "product_id", type: "uuid", fk: "products" },
    { name: "quantity", type: "integer" },
    { name: "price", type: "decimal(10,2)" },
  ],
  categories: [
    { name: "id", type: "uuid", pk: true },
    { name: "name", type: "varchar(255)" },
    { name: "slug", type: "varchar(255)" },
    { name: "created_at", type: "timestamptz" },
  ],
  reviews: [
    { name: "id", type: "uuid", pk: true },
    { name: "product_id", type: "uuid", fk: "products" },
    { name: "user_id", type: "uuid", fk: "users" },
    { name: "rating", type: "integer" },
    { name: "comment", type: "text" },
    { name: "created_at", type: "timestamptz" },
  ],
  sessions: [
    { name: "id", type: "uuid", pk: true },
    { name: "user_id", type: "uuid", fk: "users" },
    { name: "token", type: "text" },
    { name: "expires_at", type: "timestamptz" },
  ],
};

function TableNode({ data }: { data: { label: string; columns: { name: string; type: string; pk?: boolean; fk?: string }[]; rowCount: number } }) {
  return (
    <div className="bg-white rounded-lg border-2 border-neutral-border shadow-md min-w-[220px] overflow-hidden">
      {/* Table header */}
      <div className="bg-[#1A1A2E] text-white px-3 py-2 flex items-center gap-2">
        <Rows3 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
        <span className="text-sm font-semibold">{data.label}</span>
        <span className="ml-auto text-[10px] text-gray-400">{data.rowCount.toLocaleString()} rows</span>
      </div>
      {/* Columns */}
      <div className="divide-y divide-neutral-border">
        {data.columns.map((col) => (
          <div key={col.name} className="flex items-center gap-2 px-3 py-1.5 text-xs">
            <div className="w-4 shrink-0 flex justify-center">
              {col.pk && <Key className="w-3 h-3 text-amber-500" />}
              {col.fk && <Hash className="w-3 h-3 text-blue-500" />}
            </div>
            <span className="font-mono font-medium text-gray-800">{col.name}</span>
            <span className="ml-auto font-mono text-gray-400">{col.type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const nodeTypes = { tableNode: TableNode };

// Grid layout: 3 columns
const positions: Record<string, { x: number; y: number }> = {
  users:       { x: 0,   y: 0 },
  products:    { x: 320, y: 0 },
  categories:  { x: 640, y: 0 },
  orders:      { x: 0,   y: 320 },
  order_items: { x: 320, y: 320 },
  reviews:     { x: 640, y: 320 },
  sessions:    { x: 0,   y: 600 },
};

const initialNodes: Node[] = mockTables.map((table) => ({
  id: table.name,
  type: "tableNode",
  position: positions[table.name] ?? { x: 0, y: 0 },
  data: {
    label: table.name,
    columns: tableColumns[table.name] ?? [],
    rowCount: table.rowCount,
  },
}));

const initialEdges: Edge[] = [
  {
    id: "order_items-products",
    source: "order_items",
    target: "products",
    sourceHandle: null,
    targetHandle: null,
    label: "product_id",
    type: "smoothstep",
    animated: true,
    style: { stroke: "#3b82f6" },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#3b82f6" },
  },
  {
    id: "order_items-orders",
    source: "order_items",
    target: "orders",
    label: "order_id",
    type: "smoothstep",
    animated: true,
    style: { stroke: "#3b82f6" },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#3b82f6" },
  },
  {
    id: "reviews-products",
    source: "reviews",
    target: "products",
    label: "product_id",
    type: "smoothstep",
    animated: true,
    style: { stroke: "#8b5cf6" },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#8b5cf6" },
  },
  {
    id: "reviews-users",
    source: "reviews",
    target: "users",
    label: "user_id",
    type: "smoothstep",
    animated: true,
    style: { stroke: "#8b5cf6" },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#8b5cf6" },
  },
  {
    id: "orders-users",
    source: "orders",
    target: "users",
    label: "user_id",
    type: "smoothstep",
    animated: true,
    style: { stroke: "#10b981" },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#10b981" },
  },
  {
    id: "products-categories",
    source: "products",
    target: "categories",
    label: "category_id",
    type: "smoothstep",
    animated: true,
    style: { stroke: "#f59e0b" },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#f59e0b" },
  },
  {
    id: "sessions-users",
    source: "sessions",
    target: "users",
    label: "user_id",
    type: "smoothstep",
    animated: true,
    style: { stroke: "#10b981" },
    markerEnd: { type: MarkerType.ArrowClosed, color: "#10b981" },
  },
];

export function SchemaViewer() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div className="bg-white rounded-lg border border-neutral-border overflow-hidden" style={{ height: 600 }}>
      <div className="px-4 py-3 border-b border-neutral-border flex items-center justify-between">
        <h3 className="text-sm font-semibold text-dash-heading">Entity Relationship Diagram</h3>
        <span className="text-xs text-dash-muted">{mockTables.length} tables &middot; {initialEdges.length} relationships</span>
      </div>
      <div style={{ height: "calc(100% - 45px)" }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          proOptions={{ hideAttribution: true }}
        >
          <Controls position="bottom-right" />
          <MiniMap
            nodeColor="#e2e8f0"
            maskColor="rgba(0,0,0,0.08)"
            style={{ border: "1px solid #e5e7eb", borderRadius: 8 }}
          />
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#d1d5db" />
        </ReactFlow>
      </div>
    </div>
  );
}
