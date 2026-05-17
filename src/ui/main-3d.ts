import ForceGraph3D from "3d-force-graph";
import * as THREE from "three";

// ── Community color palette (oklch-inspired hex fallbacks) ──────────────────
const COLORS = [
  "#6366f1", "#ec4899", "#f59e0b", "#10b981", "#06b6d4",
  "#8b5cf6", "#ef4444", "#84cc16", "#f97316", "#14b8a6",
  "#a855f7", "#3b82f6",
];

const BG_COLOR = "#0f1117";

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

interface FGNode extends GraphNode {
  x?: number;
  y?: number;
  z?: number;
  __threeObj?: THREE.Object3D;
}

// ── State ───────────────────────────────────────────────────────────────────
let graph: ReturnType<typeof ForceGraph3D> | null = null;
let currentData: ParsedGraphData | null = null;
let is3D = true;
let highlightedCommunity: number | null = null;
const isMcpApp = window.location.origin === "null";

// ── DOM helpers ─────────────────────────────────────────────────────────────
const $ = (s: string) => document.getElementById(s)!;

// ── Glow sprite texture ─────────────────────────────────────────────────────
function createGlowTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,0.6)");
  gradient.addColorStop(0.3, "rgba(255,255,255,0.15)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

let _glowTexture: THREE.Texture | null = null;
function getGlowTexture() {
  if (!_glowTexture) _glowTexture = createGlowTexture();
  return _glowTexture;
}

// ── Render graph ────────────────────────────────────────────────────────────
function renderGraph(data: ParsedGraphData) {
  const { graphNodes, graphEdges } = data;
  if (!graphNodes || graphNodes.length === 0) return;

  currentData = data;
  highlightedCommunity = null;

  $("welcome").classList.add("hidden");
  $("loading").classList.remove("hidden");

  const container = $("graph-3d");
  const maxDegree = Math.max(1, ...graphNodes.map((n) => n.degree));

  // Build nodes & links for 3d-force-graph
  const nodes: FGNode[] = graphNodes.map((n) => ({ ...n }));
  const links = graphEdges
    .filter((e) => e.source < graphNodes.length && e.target < graphNodes.length)
    .map((e) => ({
      source: graphNodes[e.source].id,
      target: graphNodes[e.target].id,
      weight: e.weight,
    }));

  // Kill existing graph
  if (graph) {
    graph._destructor?.();
    container.innerHTML = "";
  }

  graph = ForceGraph3D()(container)
    .backgroundColor(BG_COLOR)
    .numDimensions(is3D ? 3 : 2)
    .graphData({ nodes, links })
    .nodeRelSize(1)
    .nodeVal((node: any) => 2 + (node.degree / maxDegree) * 16)
    .nodeColor((node: any) => {
      if (highlightedCommunity !== null && node.community !== highlightedCommunity) {
        return "rgba(255,255,255,0.06)";
      }
      return COLORS[node.community % COLORS.length];
    })
    .nodeThreeObject((node: any) => {
      const color = (highlightedCommunity !== null && node.community !== highlightedCommunity)
        ? "#222"
        : COLORS[node.community % COLORS.length];
      const size = 2 + (node.degree / maxDegree) * 8;

      const group = new THREE.Group();

      // Core sphere
      const geo = new THREE.SphereGeometry(size, 16, 12);
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
      group.add(new THREE.Mesh(geo, mat));

      // Glow sprite
      const spriteMat = new THREE.SpriteMaterial({
        map: getGlowTexture(),
        color,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(size * 4, size * 4, 1);
      group.add(sprite);

      return group;
    })
    .nodeThreeObjectExtend(false)
    .nodeLabel(() => "") // we handle tooltip ourselves
    .linkWidth((link: any) => Math.max(0.2, Math.min(1.5, (link.weight || 1) * 0.4)))
    .linkColor(() => "rgba(255,255,255,0.12)")
    .linkOpacity(0.5)
    .enableNodeDrag(true)
    .showNavInfo(false)
    .onNodeHover((node: any) => {
      const tooltip = $("tooltip");
      if (node) {
        const tipLabel = tooltip.querySelector(".tooltip-label") as HTMLElement;
        const tipStats = tooltip.querySelector(".tooltip-stats") as HTMLElement;
        tipLabel.textContent = node.label;
        tipStats.innerHTML = [
          stat("Connections", node.degree),
          stat("Centrality", node.bc.toFixed(4)),
          stat("Cluster", node.community),
        ].join("");
        tooltip.classList.add("visible");
      } else {
        tooltip.classList.remove("visible");
      }
    })
    .onNodeClick((node: any) => {
      if (!graph || !node) return;
      const dist = 180;
      const ratio = 1 + dist / Math.hypot(node.x || 0, node.y || 0, node.z || 0);
      graph.cameraPosition(
        { x: (node.x || 0) * ratio, y: (node.y || 0) * ratio, z: (node.z || 0) * ratio },
        node,
        800
      );
    });

  // Track mouse for tooltip positioning
  container.addEventListener("mousemove", (e) => {
    const tooltip = $("tooltip");
    tooltip.style.left = `${e.clientX + 14}px`;
    tooltip.style.top = `${e.clientY + 14}px`;
  });

  $("loading").classList.add("hidden");

  // Update header
  $("graph-title").textContent = data.contextName || "Knowledge Graph";
  $("graph-stats").textContent = `${data.nodeCount} nodes · ${data.edgeCount} edges · ${data.clusterCount} clusters`;

  // Update sidebar
  renderStatsGrid(data);
  renderClusters(data.topClusters);
  renderGaps(data.gaps);
}

function stat(label: string, value: string | number) {
  return `<div class="tooltip-stat"><span class="tooltip-stat-label">${label}</span><span>${value}</span></div>`;
}

// ── 2D/3D toggle ────────────────────────────────────────────────────────────
function initDimToggle() {
  const btn2d = $("btn-2d") as HTMLButtonElement;
  const btn3d = $("btn-3d") as HTMLButtonElement;

  btn2d.addEventListener("click", () => {
    if (!is3D) return;
    is3D = false;
    btn2d.classList.add("active");
    btn3d.classList.remove("active");
    if (graph) {
      graph.numDimensions(2);
      // Top-down camera for 2D
      setTimeout(() => {
        graph!.cameraPosition({ x: 0, y: 0, z: 600 }, { x: 0, y: 0, z: 0 }, 800);
      }, 100);
    }
  });

  btn3d.addEventListener("click", () => {
    if (is3D) return;
    is3D = true;
    btn3d.classList.add("active");
    btn2d.classList.remove("active");
    if (graph) {
      graph.numDimensions(3);
    }
  });
}

// ── Sidebar: Stats ──────────────────────────────────────────────────────────
function renderStatsGrid(data: ParsedGraphData) {
  const density = data.nodeCount > 1
    ? ((2 * data.edgeCount) / (data.nodeCount * (data.nodeCount - 1)) * 100).toFixed(1)
    : "0.0";
  ($("stat-nodes") as HTMLElement).textContent = String(data.nodeCount);
  ($("stat-edges") as HTMLElement).textContent = String(data.edgeCount);
  ($("stat-clusters") as HTMLElement).textContent = String(data.clusterCount);
  ($("stat-density") as HTMLElement).textContent = `${density}%`;
}

// ── Sidebar: Clusters ───────────────────────────────────────────────────────
function renderClusters(clusters: ParsedGraphData["topClusters"]) {
  const list = $("cluster-list");
  if (!clusters.length) {
    list.innerHTML = '<li class="empty-state">No clusters detected</li>';
    return;
  }
  list.innerHTML = clusters.slice(0, 10).map((c) => {
    const color = COLORS[c.id % COLORS.length];
    return `
      <li class="cluster-item" data-community="${c.id}">
        <div class="cluster-color" style="background:${color}"></div>
        <div class="cluster-info">
          <div class="cluster-name">${c.words.slice(0, 3).join(", ")}</div>
          <div class="cluster-size">${c.words.length} terms</div>
        </div>
      </li>`;
  }).join("");

  list.querySelectorAll(".cluster-item").forEach((li) => {
    li.addEventListener("click", () => {
      const comm = parseInt((li as HTMLElement).dataset.community || "0", 10);
      toggleHighlight(comm, li as HTMLElement);
    });
  });
}

function toggleHighlight(community: number, el: HTMLElement) {
  const list = $("cluster-list");
  if (highlightedCommunity === community) {
    // Clear highlight
    highlightedCommunity = null;
    list.querySelectorAll(".cluster-item").forEach((li) => (li as HTMLElement).style.borderColor = "");
  } else {
    highlightedCommunity = community;
    list.querySelectorAll(".cluster-item").forEach((li) => (li as HTMLElement).style.borderColor = "");
    el.style.borderColor = COLORS[community % COLORS.length];
  }
  refreshNodeAppearance();
}

function refreshNodeAppearance() {
  if (!graph || !currentData) return;
  // Force re-render by reassigning callbacks
  const maxDegree = Math.max(1, ...currentData.graphNodes.map((n) => n.degree));
  graph
    .nodeColor((node: any) => {
      if (highlightedCommunity !== null && node.community !== highlightedCommunity) {
        return "rgba(255,255,255,0.06)";
      }
      return COLORS[node.community % COLORS.length];
    })
    .nodeThreeObject((node: any) => {
      const color = (highlightedCommunity !== null && node.community !== highlightedCommunity)
        ? "#222"
        : COLORS[node.community % COLORS.length];
      const size = 2 + (node.degree / maxDegree) * 8;
      const group = new THREE.Group();
      const geo = new THREE.SphereGeometry(size, 16, 12);
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
      group.add(new THREE.Mesh(geo, mat));
      const spriteMat = new THREE.SpriteMaterial({
        map: getGlowTexture(),
        color,
        transparent: true,
        opacity: highlightedCommunity !== null && node.community !== highlightedCommunity ? 0.05 : 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(size * 4, size * 4, 1);
      group.add(sprite);
      return group;
    });
}

// ── Sidebar: Gaps ───────────────────────────────────────────────────────────
function renderGaps(gaps: ParsedGraphData["gaps"]) {
  const list = $("gap-list");
  if (!gaps || !gaps.length) {
    list.innerHTML = '<li class="empty-state">No structural gaps detected</li>';
    return;
  }
  list.innerHTML = gaps.slice(0, 8).map((g) => `
    <li class="gap-item">
      <div class="gap-nodes">
        <div class="gap-label">
          <strong>${g.source}</strong>
          <span class="gap-arrow"> ↔ </span>
          <strong>${g.target}</strong>
        </div>
      </div>
    </li>`).join("");
}

// ── Parse incoming data ─────────────────────────────────────────────────────
function handleData(raw: any) {
  let data: ParsedGraphData;

  if (raw.graphNodes) {
    data = raw;
  } else if (raw.entriesAndGraphOfContext) {
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
      const from = (gap.from?.nodes || []).slice().sort((a: any, b: any) => (b.bc || 0) - (a.bc || 0));
      const to = (gap.to?.nodes || []).slice().sort((a: any, b: any) => (b.bc || 0) - (a.bc || 0));
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
    return;
  }

  renderGraph(data);
}

// ── MCP App message handling ────────────────────────────────────────────────
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

  // graphData message from parent
  if (msg?.type === "graphData" && msg.data) {
    try {
      handleData(msg.data);
    } catch (e) {
      console.error("Failed to parse graphData:", e);
    }
  }
});

if (isMcpApp) {
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

// ── Init ────────────────────────────────────────────────────────────────────
initDimToggle();

// Expose for testing
(window as any).__handleData = handleData;

export { renderGraph, handleData };
