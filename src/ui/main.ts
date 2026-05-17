import Graph from "graphology";
import Sigma from "sigma";
import forceAtlas2 from "graphology-layout-forceatlas2";

// ── Community color palette (oklch-inspired hex fallbacks) ──────────────────
const COLORS = [
  "#6366f1", "#ec4899", "#f59e0b", "#10b981", "#06b6d4",
  "#8b5cf6", "#ef4444", "#84cc16", "#f97316", "#14b8a6",
  "#a855f7", "#3b82f6",
];

// ── Types ───────────────────────────────────────────────────────────────────
interface GraphNode {
  id: string;
  label: string;
  community: number;
  bc: number;
  degree: number;
}

interface GraphEdge {
  source: number;
  target: number;
  weight: number;
}

interface ParsedGraphData {
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
  topClusters: Array<{ id: number; words: string[]; numberRatio: number; bcRatio: number }>;
  gaps: Array<{ source: string; target: string; sourceCluster: number; targetCluster: number; sourceWords: string[]; targetWords: string[] }>;
  topNodes: string[];
  nodeCount: number;
  edgeCount: number;
  clusterCount: number;
  modularity: number;
  contextName: string;
  extendedGraphSummary?: {
    mainTopics?: any[];
    contentGaps?: any[];
  };
}

// ── State ───────────────────────────────────────────────────────────────────
let sigmaInstance: Sigma | null = null;
let graphInstance: Graph | null = null;
const isMcpApp = window.location.origin === "null";

// ── Elements ────────────────────────────────────────────────────────────────
const $ = (s: string) => document.getElementById(s)!;

// ── Render ──────────────────────────────────────────────────────────────────
function renderGraph(data: ParsedGraphData) {
  const { graphNodes, graphEdges, topClusters, gaps } = data;
  if (!graphNodes || graphNodes.length === 0) return;

  $("welcome").style.display = "none";
  $("loading").style.display = "flex";

  // Clean up previous
  if (sigmaInstance) {
    sigmaInstance.kill();
    sigmaInstance = null;
  }

  const graph = new Graph();
  graphInstance = graph;

  const maxDegree = Math.max(1, ...graphNodes.map((n) => n.degree));
  const maxBc = Math.max(0.001, ...graphNodes.map((n) => n.bc));

  // Add nodes
  for (const node of graphNodes) {
    const size = 3 + (node.degree / maxDegree) * 18;
    const color = COLORS[node.community % COLORS.length];
    graph.addNode(node.id, {
      label: node.label,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size,
      color,
      degree: node.degree,
      bc: node.bc,
      community: node.community,
    });
  }

  // Add edges (graphEdges use indices into graphNodes array)
  for (const edge of graphEdges) {
    const sourceId = graphNodes[edge.source]?.id;
    const targetId = graphNodes[edge.target]?.id;
    if (sourceId && targetId && graph.hasNode(sourceId) && graph.hasNode(targetId)) {
      try {
        graph.addEdge(sourceId, targetId, {
          weight: edge.weight,
          size: Math.max(0.3, Math.min(2, edge.weight * 0.5)),
          color: "rgba(255,255,255,0.06)",
        });
      } catch {
        // skip duplicate edges
      }
    }
  }

  // Force-directed layout
  forceAtlas2.assign(graph, {
    iterations: Math.min(200, 50 + graphNodes.length),
    settings: {
      gravity: 1,
      scalingRatio: 10,
      barnesHutOptimize: graphNodes.length > 150,
      strongGravityMode: graphNodes.length < 50,
    },
  });

  $("loading").style.display = "none";

  // Render with Sigma
  const container = $("sigma-canvas");
  sigmaInstance = new Sigma(graph, container, {
    renderEdgeLabels: false,
    labelRenderedSizeThreshold: 8,
    labelFont: "Inter, system-ui, sans-serif",
    labelColor: { color: "#e8eaf0" },
    defaultEdgeColor: "rgba(255,255,255,0.05)",
    defaultNodeColor: "#6366f1",
    labelDensity: 0.8,
    labelGridCellSize: 100,
  });

  // Tooltip
  const tooltip = $("tooltip");
  const tipName = tooltip.querySelector(".node-name") as HTMLElement;
  const tipStats = tooltip.querySelector(".node-stats") as HTMLElement;

  sigmaInstance.on("enterNode", ({ node }) => {
    const attrs = graph.getNodeAttributes(node);
    tipName.textContent = attrs.label;
    tipStats.innerHTML = `Connections: ${attrs.degree}<br>Centrality: ${(attrs.bc as number).toFixed(4)}<br>Cluster: ${attrs.community}`;
    tooltip.classList.add("visible");
  });

  sigmaInstance.on("leaveNode", () => {
    tooltip.classList.remove("visible");
  });

  sigmaInstance.getMouseCaptor().on("mousemovebody", (e: { original: MouseEvent }) => {
    tooltip.style.left = `${e.original.clientX + 14}px`;
    tooltip.style.top = `${e.original.clientY + 14}px`;
  });

  // Update header
  $("graph-title").textContent = data.contextName || "InfraNodus";
  $("graph-stats").textContent = `${data.nodeCount} nodes · ${data.edgeCount} edges · ${data.clusterCount} clusters`;

  // Update sidebar
  renderStatsGrid(data);
  renderClusters(topClusters);
  renderGaps(gaps);
}

// ── Sidebar components ──────────────────────────────────────────────────────
function renderStatsGrid(data: ParsedGraphData) {
  const grid = $("stats-grid");
  grid.innerHTML = [
    { value: data.nodeCount, label: "Nodes" },
    { value: data.edgeCount, label: "Edges" },
    { value: data.clusterCount, label: "Clusters" },
    { value: data.modularity.toFixed(2), label: "Modularity" },
  ].map((s) => `
    <div class="stat-card">
      <div class="stat-value">${s.value}</div>
      <div class="stat-label">${s.label}</div>
    </div>
  `).join("");
}

function renderClusters(clusters: ParsedGraphData["topClusters"]) {
  const list = $("cluster-list");
  list.innerHTML = clusters.slice(0, 10).map((c, i) => `
    <li data-community="${c.id}">
      <span class="cluster-dot" style="background:${COLORS[c.id % COLORS.length]};color:${COLORS[c.id % COLORS.length]}"></span>
      <span class="cluster-name">${c.words.slice(0, 3).join(", ")}</span>
      <span class="cluster-count">${c.words.length}</span>
    </li>
  `).join("");

  list.querySelectorAll("li").forEach((li) => {
    li.addEventListener("click", () => {
      const comm = parseInt(li.dataset.community || "0", 10);
      highlightCommunity(comm);
      // Toggle active
      list.querySelectorAll("li").forEach((el) => el.classList.remove("active"));
      li.classList.add("active");
    });
  });
}

function renderGaps(gaps: ParsedGraphData["gaps"]) {
  const list = $("gap-list");
  if (!gaps.length) {
    list.innerHTML = '<li style="color:var(--text-muted);font-size:11px">No structural gaps detected</li>';
    return;
  }
  list.innerHTML = gaps.slice(0, 8).map((g) => `
    <li>
      <strong>${g.source}</strong><span class="gap-arrow">↔</span><strong>${g.target}</strong>
    </li>
  `).join("");
}

// ── Highlight community ─────────────────────────────────────────────────────
function highlightCommunity(community: number) {
  if (!graphInstance || !sigmaInstance) return;

  graphInstance.forEachNode((node, attrs) => {
    graphInstance!.setNodeAttribute(node, "color",
      attrs.community === community
        ? COLORS[community % COLORS.length]
        : "rgba(255,255,255,0.08)"
    );
  });
  sigmaInstance.refresh();

  // Reset after 2.5s
  setTimeout(() => {
    if (!graphInstance || !sigmaInstance) return;
    graphInstance.forEachNode((node, attrs) => {
      graphInstance!.setNodeAttribute(node, "color",
        COLORS[(attrs.community as number) % COLORS.length]
      );
    });
    sigmaInstance!.refresh();
  }, 2500);
}

// ── Parse incoming data ─────────────────────────────────────────────────────
function handleData(raw: any) {
  // Handle different data shapes
  let data: ParsedGraphData;

  if (raw.graphNodes) {
    // Already our ParsedGraphData format
    data = raw;
  } else if (raw.entriesAndGraphOfContext) {
    // Raw InfraNodus API response — parse it client-side
    const g = raw.entriesAndGraphOfContext?.graph?.graphologyGraph;
    if (!g?.nodes?.length) return;
    const attr = g.attributes || {};
    const rawNodes = g.nodes || [];
    const rawEdges = g.edges || [];

    const graphNodes = rawNodes.map((n: any) => ({
      id: n.key, label: n.key,
      community: n.attributes?.community ?? 0,
      bc: n.attributes?.betweenness ?? n.attributes?.bc ?? 0,
      degree: n.attributes?.degree ?? 1,
    }));

    const nodeIdx: Record<string, number> = {};
    graphNodes.forEach((n: any, i: number) => { nodeIdx[n.id] = i; });

    const graphEdges = rawEdges
      .map((e: any) => ({ source: nodeIdx[e.source], target: nodeIdx[e.target], weight: e.attributes?.weight ?? 1 }))
      .filter((e: any) => e.source != null && e.target != null);

    const topClusters = (attr.top_clusters || []).map((c: any) => ({
      id: parseInt(c.community ?? c.id ?? 0),
      words: c.nodes?.map((n: any) => n.nodeName) || [],
      numberRatio: c.numberRatio || 0, bcRatio: c.bcRatio || 0,
    }));

    const gaps = (attr.gaps || []).map((gap: any) => {
      const from = (gap.from?.nodes || []).slice().sort((a: any, b: any) => (b.bc||0)-(a.bc||0));
      const to = (gap.to?.nodes || []).slice().sort((a: any, b: any) => (b.bc||0)-(a.bc||0));
      return {
        source: from[0]?.nodeName || "?", target: to[0]?.nodeName || "?",
        sourceCluster: gap.from?.community ?? 0, targetCluster: gap.to?.community ?? 0,
        sourceWords: from.map((n: any) => n.nodeName), targetWords: to.map((n: any) => n.nodeName),
      };
    });

    data = {
      graphNodes, graphEdges, topClusters, gaps,
      topNodes: attr.top_nodes || [],
      nodeCount: graphNodes.length, edgeCount: graphEdges.length,
      clusterCount: topClusters.length,
      modularity: 0, contextName: "Graph",
    };
  } else {
    return; // Unknown format
  }

  renderGraph(data);
}

// ── MCP App message handling ────────────────────────────────────────────────
// Always listen for messages (works in MCP App iframe and standalone testing)
window.addEventListener("message", (event) => {
    const msg = event.data;

    // JSON-RPC 2.0 from MCP host
    if (msg?.jsonrpc === "2.0") {
      if (msg.method === "notifications/tool_result") {
        try {
          const content = msg.params?.content;
          const text = typeof content === "string" ? content : content?.text;
          if (text) handleData(JSON.parse(text));
        } catch (e) {
          console.error("Failed to parse tool result:", e);
        }
      }
      if (msg.method === "notifications/host_context_changed") {
        applyHostStyles(msg.params);
      }
    }

    // Simple message format (direct data pass)
    if (msg?.type === "tool_result" && msg.content) {
      try {
        handleData(typeof msg.content === "string" ? JSON.parse(msg.content) : msg.content);
      } catch (e) {
        console.error("Failed to parse direct tool result:", e);
      }
    }
});

if (isMcpApp) {
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

// ── Standalone mode ─────────────────────────────────────────────────────────
if (!isMcpApp) {
  const params = new URLSearchParams(window.location.search);
  const dataUrl = params.get("data");
  if (dataUrl) {
    fetch(dataUrl)
      .then((r) => r.json())
      .then(handleData)
      .catch((e) => console.error("Failed to load graph data:", e));
  }
}

// Expose for testing
(window as any).__handleData = handleData;

export { renderGraph, handleData };
