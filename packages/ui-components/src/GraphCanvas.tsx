import { useState } from "react";
import type { PatternGraph, GraphNode } from "@strudel-studio/pattern-graph";
import { getNodeLabel } from "./laneStackUtils.js";

/** MIME type for drag of a pattern library entry (v1.1 drag-and-drop). */
export const LIBRARY_PATTERN_DRAG_TYPE = "application/x-strudel-library-pattern";

export interface GraphCanvasProps {
  graph: PatternGraph;
  className?: string;
  selectedNodeId?: string;
  onSelectNode?: (nodeId: string) => void;
  /** When provided, lane cards become draggable to reorder; called with the new lane id order. */
  onReorderLanes?: (newOrder: string[]) => void;
  /** When provided, lane cards accept drop of a library pattern; called with (laneId, libraryEntryId). */
  onDropLibraryPattern?: (laneId: string, libraryEntryId: string) => void;
  /** When provided, plugin node cards show a remove control; called with nodeId. */
  onDeletePluginNode?: (nodeId: string) => void;
}

function isCompositionRoot(
  node: GraphNode,
): node is GraphNode & { type: "parallel" | "serial"; order?: string[] } {
  return node.type === "parallel" || node.type === "serial";
}

export function GraphCanvas({
  graph,
  className,
  selectedNodeId,
  onSelectNode,
  onReorderLanes,
  onDropLibraryPattern,
  onDeletePluginNode,
}: GraphCanvasProps) {
  const [isDragging, setIsDragging] = useState(false);
  const nodesById = new Map<string, GraphNode>(
    graph.nodes.map((n) => [n.id, n]),
  );

  const root = nodesById.get(graph.root);

  if (!root) {
    return (
      <div className={className}>
        <p style={{ fontSize: "0.85rem", color: "#777" }}>
          Graph has no root node.
        </p>
      </div>
    );
  }

  if (!isCompositionRoot(root)) {
    return (
      <div className={className}>
        <p style={{ fontSize: "0.85rem", color: "#777" }}>
          Composition graph view supports parallel or serial root only.
        </p>
        <div
          style={{
            marginTop: "0.5rem",
            padding: "0.5rem 0.75rem",
            borderRadius: "4px",
            border: "1px solid #ccc",
            fontFamily: "monospace",
            fontSize: "0.85rem",
            backgroundColor: "#fafafa",
          }}
        >
          <strong>Root</strong>: {getNodeLabel(graph, root.id)}
        </div>
      </div>
    );
  }

  const childIds = root.order ?? [];

  return (
    <div className={className}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0",
          alignItems: "center",
        }}
      >
        <div
          role={onSelectNode ? "button" : undefined}
          aria-label={`Composition root: ${getNodeLabel(graph, root.id)}`}
          tabIndex={onSelectNode ? 0 : undefined}
          style={{
            padding: "0.3rem 0.6rem",
            borderRadius: "999px",
            border:
              selectedNodeId === root.id ? "1px solid #007acc" : "1px solid #aaa",
            backgroundColor:
              selectedNodeId === root.id ? "#e6f3ff" : "#f3f3f3",
            fontFamily: "monospace",
            fontSize: "0.85rem",
          }}
          onClick={() => {
            if (onSelectNode) {
              onSelectNode(root.id);
            }
          }}
          onKeyDown={(e) => {
            if (onSelectNode && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              onSelectNode(root.id);
            }
          }}
        >
          {getNodeLabel(graph, root.id)}
        </div>

        {childIds.length > 0 && (
          <svg
            width="100%"
            height="14"
            viewBox="0 0 100 14"
            preserveAspectRatio="none"
            style={{ display: "block", flexShrink: 0 }}
            aria-hidden
          >
            <path
              d="M 50 0 L 50 14 M 0 14 L 100 14"
              fill="none"
              stroke="#999"
              strokeWidth="1.5"
            />
          </svg>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          {childIds.length === 0 ? (
            <p style={{ fontSize: "0.85rem", color: "#777" }}>
              No lanes or plugin nodes. Add a lane or plugin node below.
            </p>
          ) : (
            childIds.map((childId, idx) => {
              const node = nodesById.get(childId);
              if (!node) return null;

              if (node.type === "plugin") {
                const isSelected = selectedNodeId === childId;
                const canDrag = !!onReorderLanes && childIds.length > 1;
                const label = getNodeLabel(graph, childId);
                return (
                  <div
                    key={childId}
                    role={onSelectNode ? "button" : undefined}
                    aria-label={`Plugin node ${label}`}
                    tabIndex={onSelectNode ? 0 : undefined}
                    draggable={canDrag}
                    onDragStart={(e) => {
                      if (!onReorderLanes) return;
                      setIsDragging(true);
                      e.dataTransfer.setData("text/plain", childId);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => setIsDragging(false)}
                    onDragOver={(e) => {
                      if (onReorderLanes) {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      if (!onReorderLanes) return;
                      const draggedId = e.dataTransfer.getData("text/plain");
                      const fromIndex = childIds.indexOf(draggedId);
                      if (fromIndex === -1 || fromIndex === idx) return;
                      const newOrder = [...childIds];
                      const [removed] = newOrder.splice(fromIndex, 1);
                      newOrder.splice(idx, 0, removed!);
                      onReorderLanes(newOrder);
                    }}
                    style={{
                      minWidth: "10rem",
                      maxWidth: "14rem",
                      padding: "0.5rem 0.75rem",
                      borderRadius: "6px",
                      border: isSelected ? "1px solid #007acc" : "1px solid #ccc",
                      backgroundColor: "#e8f4e8",
                      boxShadow: isSelected ? "0 0 0 2px rgba(0,122,204,0.15)" : "0 1px 2px rgba(0,0,0,0.04)",
                      fontFamily: "monospace",
                      fontSize: "0.8rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.25rem",
                      cursor: canDrag ? (isDragging ? "grabbing" : "grab") : undefined,
                    }}
                    onClick={() => onSelectNode?.(childId)}
                    onKeyDown={(e) => {
                      if (onSelectNode && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        onSelectNode(childId);
                      }
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontWeight: 600 }}>{label}</span>
                      {onDeletePluginNode && (
                        <button
                          type="button"
                          aria-label={`Remove plugin node ${childId}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeletePluginNode(childId);
                          }}
                          style={{ fontSize: "0.75rem", padding: "0.1rem 0.35rem" }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                );
              }

              if (node.type !== "lane") return null;
              const laneNode = node;
              const chainNode = nodesById.get(laneNode.head);
              const isSelected = selectedNodeId === childId;
              const canDrag = !!onReorderLanes && childIds.length > 1;

              return (
                <div
                  key={childId}
                  role={onSelectNode ? "button" : undefined}
                  aria-label={`Lane ${childId}${chainNode?.type === "transformChain" ? `: ${chainNode.base.kind}("${chainNode.base.miniSerialization}")` : ""}`}
                  tabIndex={onSelectNode ? 0 : undefined}
                  draggable={canDrag}
                  onDragStart={(e) => {
                    if (!onReorderLanes) return;
                    setIsDragging(true);
                    e.dataTransfer.setData("text/plain", childId);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => setIsDragging(false)}
                  onDragOver={(e) => {
                    const hasLibrary = e.dataTransfer.types.includes(LIBRARY_PATTERN_DRAG_TYPE);
                    if (hasLibrary && onDropLibraryPattern) {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "copy";
                      return;
                    }
                    if (onReorderLanes) {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.types.includes(LIBRARY_PATTERN_DRAG_TYPE) && onDropLibraryPattern) {
                      const id = e.dataTransfer.getData(LIBRARY_PATTERN_DRAG_TYPE);
                      if (id) onDropLibraryPattern(childId, id);
                      return;
                    }
                    if (!onReorderLanes) return;
                    const draggedId = e.dataTransfer.getData("text/plain");
                    const fromIndex = childIds.indexOf(draggedId);
                    if (fromIndex === -1 || fromIndex === idx) return;
                    const newOrder = [...childIds];
                    const [removed] = newOrder.splice(fromIndex, 1);
                    newOrder.splice(idx, 0, removed!);
                    onReorderLanes(newOrder);
                  }}
                  style={{
                    minWidth: "10rem",
                    maxWidth: "14rem",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "6px",
                    border: isSelected ? "1px solid #007acc" : "1px solid #ccc",
                    backgroundColor: "#fff",
                    boxShadow: isSelected ? "0 0 0 2px rgba(0,122,204,0.15)" : "0 1px 2px rgba(0,0,0,0.04)",
                    fontFamily: "monospace",
                    fontSize: "0.8rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.25rem",
                    cursor: canDrag ? (isDragging ? "grabbing" : "grab") : undefined,
                  }}
                  onClick={() => onSelectNode?.(childId)}
                  onKeyDown={(e) => {
                    if (onSelectNode && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      onSelectNode(childId);
                    }
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontWeight: 600 }}>{childId}</span>
                    {typeof (laneNode as any).cycleHint === "number" && (
                      <span style={{ fontSize: "0.7rem", color: "#555" }}>
                        cycle={String((laneNode as any).cycleHint)}
                      </span>
                    )}
                  </div>
                  <div>
                    {chainNode?.type === "transformChain" ? (
                      <code>{`${chainNode.base.kind}("${chainNode.base.miniSerialization}")`}</code>
                    ) : (
                      <span style={{ color: "#888" }}>(no transform chain)</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

