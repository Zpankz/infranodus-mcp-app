// ============================================================
// Force-graph mockup component (deterministic layout — no physics)
// Produces visually convincing network with clusters, hulls, labels.
// Variant: "topology" (sharp) or "atlas" (soft glow, multi-cluster color)
// ============================================================

const { useMemo } = React;

// ---- Seeded RNG so layouts are stable across renders -------------
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- Cluster definition ------------------------------------------
// Each cluster: name, center (cx, cy), spread, color var, members[]
const DEFAULT_CLUSTERS = [
  {
    name: "knowledge graph",
    cx: 0.30, cy: 0.40, r: 0.18, color: "var(--c-orange)",
    members: ["graph", "node", "edge", "concept", "ontology", "vertex", "topology"],
  },
  {
    name: "language model",
    cx: 0.66, cy: 0.32, r: 0.16, color: "var(--c-cyan)",
    members: ["llm", "prompt", "context", "embedding", "token", "claude"],
  },
  {
    name: "discourse analysis",
    cx: 0.52, cy: 0.70, r: 0.17, color: "var(--c-violet)",
    members: ["text", "discourse", "narrative", "frame", "rhetoric", "voice"],
  },
  {
    name: "network science",
    cx: 0.20, cy: 0.78, r: 0.14, color: "var(--c-lime)",
    members: ["betweenness", "modularity", "centrality", "community"],
  },
  {
    name: "gaps",
    cx: 0.85, cy: 0.70, r: 0.10, color: "var(--c-magenta)",
    members: ["blind-spot", "gap", "bridge"],
  },
];

function buildGraph({ seed = 7, density = "balanced", clusters = DEFAULT_CLUSTERS } = {}) {
  const rand = mulberry32(seed);
  const nodes = [];
  const edges = [];

  // density scales nodes per cluster and inter-cluster edges
  const dMul = density === "sparse" ? 0.6 : density === "dense" ? 1.6 : 1;

  clusters.forEach((cl, ci) => {
    cl.members.forEach((m, mi) => {
      // jitter inside the cluster radius
      const a = rand() * Math.PI * 2;
      const rr = Math.sqrt(rand()) * cl.r;
      const x = cl.cx + Math.cos(a) * rr;
      const y = cl.cy + Math.sin(a) * rr * 0.85; // slight vertical squash
      // size varies: first 2 of each cluster are "hubs"
      const isHub = mi < 2;
      const weight = isHub ? 1 : 0.4 + rand() * 0.4;
      nodes.push({
        id: `${ci}-${mi}`,
        label: m,
        cluster: ci,
        color: cl.color,
        x, y,
        r: 3 + weight * (isHub ? 6.5 : 3.5),
        weight,
        isHub,
      });
    });
    // Add intra-cluster edges (hub → others)
    const clNodes = nodes.filter((n) => n.cluster === ci);
    const hubs = clNodes.filter((n) => n.isHub);
    clNodes.forEach((n) => {
      if (n.isHub) return;
      hubs.forEach((h) => {
        if (rand() < 0.8 * dMul) edges.push({ s: h.id, t: n.id, w: 0.4 });
      });
    });
    // Some lateral edges
    for (let i = 0; i < clNodes.length; i++) {
      for (let j = i + 1; j < clNodes.length; j++) {
        if (rand() < 0.18 * dMul) edges.push({ s: clNodes[i].id, t: clNodes[j].id, w: 0.25 });
      }
    }
  });

  // Inter-cluster bridges (the "gaps" — bridging is what InfraNodus surfaces)
  const bridges = [
    [0, 1, 2], [0, 2, 3], [1, 2, 2], [2, 3, 1], [0, 3, 1], [1, 4, 1], [2, 4, 1],
  ];
  bridges.forEach(([a, b, count]) => {
    const A = nodes.filter((n) => n.cluster === a && n.isHub);
    const B = nodes.filter((n) => n.cluster === b && n.isHub);
    for (let k = 0; k < count * dMul; k++) {
      const sa = A[Math.floor(rand() * A.length)];
      const sb = B[Math.floor(rand() * B.length)];
      if (sa && sb) edges.push({ s: sa.id, t: sb.id, w: 0.7, bridge: true });
    }
  });

  return { nodes, edges, clusters };
}

// ---- Convex-hull-ish blob path for cluster background ------------
function clusterPath(nodes, padding = 0.045) {
  if (nodes.length < 3) return "";
  // centroid
  let cx = 0, cy = 0;
  nodes.forEach((n) => { cx += n.x; cy += n.y; });
  cx /= nodes.length; cy /= nodes.length;
  // sort by angle
  const sorted = nodes
    .map((n) => ({ ...n, ang: Math.atan2(n.y - cy, n.x - cx) }))
    .sort((a, b) => a.ang - b.ang);
  // expand outward
  const pts = sorted.map((n) => {
    const dx = n.x - cx, dy = n.y - cy;
    const len = Math.hypot(dx, dy) || 1;
    return { x: n.x + (dx / len) * padding, y: n.y + (dy / len) * padding };
  });
  // smooth bezier through points
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % pts.length];
    const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
    d += ` Q ${p1.x} ${p1.y} ${mx} ${my}`;
  }
  d += " Z";
  return d;
}

function ForceGraph({
  seed = 7,
  density = "balanced",
  variant = "topology",      // "topology" | "atlas"
  showLabels = "hubs",       // "all" | "hubs" | "none"
  focus = null,              // node id to focus
  highlightCluster = null,
  showHulls = true,
  showAxis = false,
  className = "",
  style,
}) {
  const { nodes, edges, clusters } = useMemo(() => buildGraph({ seed, density }), [seed, density]);

  // 1000x700 viewbox; data is 0..1
  const W = 1000, H = 700;
  const X = (v) => v * W;
  const Y = (v) => v * H;
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));

  return (
    <svg className={`graph-svg ${className}`} viewBox={`0 0 ${W} ${H}`} style={style} preserveAspectRatio="xMidYMid meet">
      {/* subtle grid for topology / void for atlas */}
      {showAxis && (
        <g opacity="0.4">
          {Array.from({ length: 12 }, (_, i) => (
            <line key={`gx${i}`} x1={(i + 1) * (W / 12)} x2={(i + 1) * (W / 12)} y1="0" y2={H} stroke="var(--host-border-2)" strokeWidth="0.5" />
          ))}
          {Array.from({ length: 8 }, (_, i) => (
            <line key={`gy${i}`} x1="0" x2={W} y1={(i + 1) * (H / 8)} y2={(i + 1) * (H / 8)} stroke="var(--host-border-2)" strokeWidth="0.5" />
          ))}
        </g>
      )}

      {/* cluster hulls */}
      {showHulls && clusters.map((cl, ci) => {
        const clNodes = nodes.filter((n) => n.cluster === ci);
        const path = clusterPath(clNodes.map((n) => ({ x: X(n.x), y: Y(n.y) })));
        const isHi = highlightCluster === ci;
        return (
          <path
            key={`hull-${ci}`}
            d={path}
            fill={cl.color}
            fillOpacity={variant === "atlas" ? (isHi ? 0.16 : 0.07) : (isHi ? 0.14 : 0.05)}
            stroke={cl.color}
            strokeOpacity={isHi ? 0.5 : 0.18}
            strokeWidth={isHi ? 1 : 0.6}
            strokeDasharray={variant === "topology" ? "3 5" : "0"}
          />
        );
      })}

      {/* edges */}
      <g>
        {edges.map((e, i) => {
          const a = byId[e.s], b = byId[e.t];
          if (!a || !b) return null;
          const isFocused = focus && (e.s === focus || e.t === focus);
          const isBridge = e.bridge;
          return (
            <line
              key={i}
              x1={X(a.x)} y1={Y(a.y)} x2={X(b.x)} y2={Y(b.y)}
              stroke={isFocused ? "var(--in-accent)" : isBridge ? "var(--c-magenta)" : "var(--host-border)"}
              strokeWidth={isFocused ? 1.4 : isBridge ? 0.7 : 0.5}
              strokeOpacity={focus ? (isFocused ? 1 : 0.18) : (isBridge ? 0.7 : (variant === "atlas" ? 0.45 : 0.6))}
              strokeDasharray={isBridge && variant === "topology" ? "2 3" : "0"}
            />
          );
        })}
      </g>

      {/* nodes */}
      <g>
        {nodes.map((n) => {
          const dim = focus && focus !== n.id;
          return (
            <g key={n.id} style={{ color: n.color }} opacity={dim ? 0.35 : 1}>
              <circle
                className="node"
                cx={X(n.x)} cy={Y(n.y)} r={n.r}
                fill={n.color}
                stroke={variant === "topology" ? "var(--host-bg)" : "var(--host-bg-2)"}
                strokeWidth={variant === "topology" ? 1.2 : 0.6}
              />
              {variant === "atlas" && n.isHub && (
                <circle cx={X(n.x)} cy={Y(n.y)} r={n.r + 4} fill={n.color} opacity="0.15" />
              )}
            </g>
          );
        })}
      </g>

      {/* labels */}
      <g>
        {nodes.map((n) => {
          if (showLabels === "none") return null;
          if (showLabels === "hubs" && !n.isHub) return null;
          const dim = focus && focus !== n.id;
          return (
            <text
              key={`l-${n.id}`}
              className={`label ${n.isHub ? "hi" : ""}`}
              x={X(n.x) + n.r + 3} y={Y(n.y) + 3}
              opacity={dim ? 0.35 : 1}
            >
              {n.label}
            </text>
          );
        })}
      </g>
    </svg>
  );
}

// Compact mini-graph (used in sidebars / cards)
function MiniGraph({ seed = 11, variant = "atlas", style }) {
  return <ForceGraph seed={seed} density="sparse" variant={variant} showLabels="none" showHulls={false} style={style} />;
}

Object.assign(window, { ForceGraph, MiniGraph, buildGraph });
