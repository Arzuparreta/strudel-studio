import type { PatternGraph, GraphNode } from "@strudel-studio/pattern-graph";
import { getNodeLabel } from "./laneStackUtils.js";

export interface GraphCanvasProps {
  graph: PatternGraph;
  className?: string;
}

export function GraphCanvas({ graph, className }: GraphCanvasProps) {
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

  if (root.type !== "parallel") {
    return (
      <div className={className}>
        <p style={{ fontSize: "0.85rem", color: "#777" }}>
          Composition graph view currently supports a parallel root only.
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

  const laneIds = root.order ?? [];

  return (
    <div className={className}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
        }}
      >
        <div
          style={{
            alignSelf: "center",
            padding: "0.3rem 0.6rem",
            borderRadius: "999px",
            border: "1px solid #aaa",
            backgroundColor: "#f3f3f3",
            fontFamily: "monospace",
            fontSize: "0.85rem",
          }}
        >
          {getNodeLabel(graph, root.id)}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          {laneIds.length === 0 ? (
            <p style={{ fontSize: "0.85rem", color: "#777" }}>
              No lanes attached to the parallel root.
            </p>
          ) : (
            laneIds.map((laneId) => {
              const laneNode = nodesById.get(laneId);
              if (!laneNode || laneNode.type !== "lane") {
                return null;
              }
              const chainNode = nodesById.get(laneNode.head);

              return (
                <div
                  key={laneId}
                  style={{
                    minWidth: "10rem",
                    maxWidth: "14rem",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "6px",
                    border: "1px solid #ccc",
                    backgroundColor: "#fff",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                    fontFamily: "monospace",
                    fontSize: "0.8rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.25rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                      }}
                    >
                      {laneId}
                    </span>
                    {typeof (laneNode as any).cycleHint === "number" && (
                      <span
                        style={{
                          fontSize: "0.7rem",
                          color: "#555",
                        }}
                      >
                        cycle={String((laneNode as any).cycleHint)}
                      </span>
                    )}
                  </div>
                  <div>
                    {chainNode && chainNode.type === "transformChain" ? (
                      <code>
                        {chainNode.base.kind}("
                        {chainNode.base.miniSerialization}")
                      </code>
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

