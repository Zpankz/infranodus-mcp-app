import Graph from "graphology";
import Sigma from "sigma";
import forceAtlas2 from "graphology-layout-forceatlas2";

const COMMUNITY_COLORS = [
  "#6366f1", "#ec4899", "#f59e0b", "#10b981", "#06b6d4",
  "#8b5cf6", "#ef4444", "#84cc16", "#f97316", "#14b8a6",
  "#a855f7", "#3b82f6",
];

interface InfraNodusNode {
  key: string;
  attributes?: {
    label?: string;
    degree?: number;
    bc?: number;
    community?: number;
    x?: number;
    y?: number;
    size?: number;
  };
}

interface InfraNodusEdge {
  source: string;
  target: string;
  attributes?: {
    weight?: number;
  };
}

interface GraphPayload {
  entriesAndGraphOfContext?: {
    graph?: {
      graphologyGraph?: {
        nodes?: InfraNodusNode[];
        edges?: InfraNodusEdge[];
        attributes?: {
          top_clusters?: Array<{ label: string; nodes: string[] }>;
          gaps?: Array<{ cluster1: string; cluster2: string; suggestion?: string }>;
          top_nodes?: string[];
        };
      };
    };
    graphSummary?: string;
  };
  nodes?: InfraNodusNode[];
  edges?: InfraNodusEdge[];
}

let sigmaInstance: Sigma | null = null;
let graphInstance: Graph | null = null;

const isMcpApp = window.location.origin === "null";

function renderGraph(payload: GraphPayload) {
  const graphData =
    payload.entriesAndGraphOfContext?.graph?.graphologyGraph || payload;
  const nodes: InfraNodusNode[] =
    (graphData as { nodes?: InfraNodusNode[] }).nodes || [];
  const edges: InfraNodusEdge[] =
    (graphData as { edges?: InfraNodusEdge[] }).edges || [];
  const attrs = (graphData as { attributes?: GraphPayload["entriesAndGraphOfContext"] extends { graph?: { graphologyGraph?: { attributes?: infer A } } } ? A : never }).attributes ||
    payload.entriesAndGraphOfContext?.graph?.graphologyGraph?.attributes ||
    {};

  if (nodes.length === 0) return;

  document.getElementById("loading")!.style.display = "none";

  if (sigmaInstance) {
    sigmaInstance.kill();
    sigmaInstance = null;
  }

  const graph = new Graph();
  graphInstance = graph;

  const maxDegree = Math.max(...nodes.map((n) => n.attributes?.degree || 1));

  for (const node of nodes) {
    const community = node.attributes?.community || 0;
    const degree = node.attributes?.degree || 1;
    const size = 3 + (degree / maxDegree) * 18;

    graph.addNode(node.key, {
      label: node.attributes?.label || node.key,
      x: node.attributes?.x || Math.random() * 100,
      y: node.attributes?.y || Math.random() * 100,
      size,
      color: COMMUNITY_COLORS[community % COMMUNITY_COLORS.length],
      degree,
      bc: node.attributes?.bc || 0,
      community,
    });
  }

  for (const edge of edges) {
    if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
      try {
        graph.addEdge(edge.source, edge.target, {
          weight: edge.attributes?.weight || 1,
          size: Math.max(0.5, (edge.attributes?.weight || 1) * 0.5),
          color: "rgba(255,255,255,0.08)",
        });
      } catch {
        // skip duplicate edges
      }
    }
  }

  // Force-directed layout
  forceAtlas2.assign(graph, {
    iterations: 100,
    settings: {
      gravity: 1,
      scalingRatio: 10,
      barnesHutOptimize: nodes.length > 200,
    },
  });

  const container = document.getElementById("sigma-canvas")!;
  sigmaInstance = new Sigma(graph, container, {
    renderEdgeLabels: false,
    labelRenderedSizeThreshold: 8,
    labelFont: "var(--font-sans, Inter, system-ui)",
    labelColor: { color: "#e8eaf0" },
    defaultEdgeColor: "rgba(255,255,255,0.06)",
    defaultNodeColor: "#6366f1",
  });

  // Hover tooltip
  const tooltip = document.getElementById("tooltip")!;
  sigmaInstance.on("enterNode", ({ node }) => {
    const nodeAttrs = graph.getNodeAttributes(node);
    tooltip.querySelector(".node-name")!.textContent = nodeAttrs.label;
    tooltip.querySelector(".node-stats")!.textContent =
      `Connections: ${nodeAttrs.degree} | Centrality: ${(nodeAttrs.bc as number).toFixed(3)}`;
    tooltip.classList.add("visible");
  });

  sigmaInstance.on("leaveNode", () => {
    tooltip.classList.remove("visible");
  });

  sigmaInstance.getMouseCaptor().on("mousemovebody", (e: { original: MouseEvent }) => {
    tooltip.style.left = `${e.original.clientX + 12}px`;
    tooltip.style.top = `${e.original.clientY + 12}px`;
  });

  // Update UI
  const statsEl = document.getElementById("graph-stats")!;
  statsEl.textContent = `${nodes.length} nodes · ${edges.length} edges`;

  renderClusters(attrs as { top_clusters?: Array<{ label: string; nodes: string[] }> });
  renderGaps(attrs as { gaps?: Array<{ cluster1: string; cluster2: string; suggestion?: string }> });
}

function renderClusters(attrs: { top_clusters?: Array<{ label: string; nodes: string[] }> }) {
  const list = document.getElementById("cluster-list")!;
  const clusters = attrs.top_clusters || [];

  list.innerHTML = clusters
    .slice(0, 8)
    .map(
      (c, i) => `
      <li data-community="${i}">
        <span class="cluster-dot" style="background:${COMMUNITY_COLORS[i % COMMUNITY_COLORS.length]}"></span>
        <span class="cluster-name">${c.label}</span>
        <span class="cluster-count">${c.nodes.length}</span>
      </li>`
    )
    .join("");

  list.querySelectorAll("li").forEach((li) => {
    li.addEventListener("click", () => {
      const community = parseInt(li.dataset.community || "0", 10);
      highlightCommunity(community);
    });
  });
}

function renderGaps(attrs: { gaps?: Array<{ cluster1: string; cluster2: string; suggestion?: string }> }) {
  const list = document.getElementById("gap-list")!;
  const gaps = attrs.gaps || [];

  list.innerHTML = gaps.length
    ? gaps
        .slice(0, 6)
        .map(
          (g) => `
        <li>
          <strong>${g.cluster1}</strong><span class="gap-arrow">↔</span><strong>${g.cluster2}</strong>
          ${g.suggestion ? `<br><span style="color:var(--text-secondary)">${g.suggestion}</span>` : ""}
        </li>`
        )
        .join("")
    : "<li style='color:var(--text-muted)'>No gaps detected</li>";
}

function highlightCommunity(community: number) {
  if (!graphInstance || !sigmaInstance) return;

  graphInstance.forEachNode((node, attrs) => {
    graphInstance!.setNodeAttribute(
      node,
      "color",
      attrs.community === community
        ? COMMUNITY_COLORS[community % COMMUNITY_COLORS.length]
        : "rgba(255,255,255,0.1)"
    );
  });

  sigmaInstance.refresh();

  setTimeout(() => {
    graphInstance!.forEachNode((node, attrs) => {
      graphInstance!.setNodeAttribute(
        node,
        "color",
        COMMUNITY_COLORS[(attrs.community as number) % COMMUNITY_COLORS.length]
      );
    });
    sigmaInstance!.refresh();
  }, 2000);
}

// MCP App message handling (postMessage from host)
if (isMcpApp) {
  window.addEventListener("message", (event) => {
    const msg = event.data;

    if (msg?.jsonrpc === "2.0") {
      if (msg.method === "notifications/tool_result") {
        try {
          const content = msg.params?.content;
          if (typeof content === "string") {
            renderGraph(JSON.parse(content));
          } else if (content?.text) {
            renderGraph(JSON.parse(content.text));
          }
        } catch (e) {
          console.error("Failed to parse tool result:", e);
        }
      }

      if (msg.method === "notifications/host_context_changed") {
        applyHostStyles(msg.params);
      }
    }

    // Simpler message format (direct data pass)
    if (msg?.type === "tool_result" && msg.content) {
      try {
        renderGraph(
          typeof msg.content === "string"
            ? JSON.parse(msg.content)
            : msg.content
        );
      } catch (e) {
        console.error("Failed to parse direct tool result:", e);
      }
    }
  });

  // Signal ready to host
  window.parent.postMessage(
    { jsonrpc: "2.0", method: "notifications/ready", params: {} },
    "*"
  );
}

function applyHostStyles(params: { styles?: Record<string, string> }) {
  if (!params.styles) return;
  const root = document.documentElement;
  for (const [key, value] of Object.entries(params.styles)) {
    root.style.setProperty(key, value);
  }
}

// Standalone mode: check URL params for data
if (!isMcpApp) {
  const params = new URLSearchParams(window.location.search);
  const dataUrl = params.get("data");
  if (dataUrl) {
    fetch(dataUrl)
      .then((r) => r.json())
      .then(renderGraph)
      .catch((e) => console.error("Failed to load graph data:", e));
  }
}

export { renderGraph };
