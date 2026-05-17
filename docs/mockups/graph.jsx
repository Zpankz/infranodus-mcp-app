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

// ---- D3 schemePaired — extension's color choice ------------------
// 12 colors in 6 light/dark pairs. Even index = light (satellites);
// odd index = dark (hubs). Mirrors what graph.infranodus.com renders.
const SCHEME_PAIRED = [
  "#a6cee3", "#1f78b4",   // 0,1  blue
  "#b2df8a", "#33a02c",   // 2,3  green
  "#fb9a99", "#e31a1c",   // 4,5  red
  "#fdbf6f", "#ff7f00",   // 6,7  orange
  "#cab2d6", "#6a3d9a",   // 8,9  purple
  "#ffff99", "#b15928",   // 10,11 yellow/brown
];

// Cluster definitions. `paired` indexes into SCHEME_PAIRED for the
// light variant; hubs get +1 (dark variant). `hue` is the H value used
// for source-tinted edge coloring (extension renders edges as
// `hsl(node.hue, 100%, 50%)` — vibrant saturated link strokes).
const DEFAULT_CLUSTERS = [
  { name: "knowledge graph",    cx: 0.30, cy: 0.40, r: 0.18, paired: 6,  hue:  30,
    members: ["graph", "node", "edge", "concept", "ontology", "vertex", "topology"] },
  { name: "language model",     cx: 0.66, cy: 0.32, r: 0.16, paired: 0,  hue: 205,
    members: ["llm", "prompt", "context", "embedding", "token", "claude"] },
  { name: "discourse analysis", cx: 0.52, cy: 0.70, r: 0.17, paired: 8,  hue: 280,
    members: ["text", "discourse", "narrative", "frame", "rhetoric", "voice"] },
  { name: "network science",    cx: 0.20, cy: 0.78, r: 0.14, paired: 2,  hue: 130,
    members: ["betweenness", "modularity", "centrality", "community"] },
  { name: "gaps",               cx: 0.85, cy: 0.70, r: 0.10, paired: 4,  hue: 350,
    members: ["blind-spot", "gap", "bridge"] },
];

// Resolve cluster color → CSS var fallback (for tokens that reference
// the InfraNodus dark-theme accents) plus the literal scheme color.
function clusterColor(cl, isHub) { return SCHEME_PAIRED[cl.paired + (isHub ? 1 : 0)]; }

function buildGraph({ seed = 7, density = "balanced", clusters = DEFAULT_CLUSTERS } = {}) {
  const rand = mulberry32(seed);
  const nodes = [];
  const edges = [];

  // density scales nodes per cluster and inter-cluster edges
  const dMul = density === "sparse" ? 0.6 : density === "dense" ? 1.6 : 1;

  // Stage 1 — generate nodes seeded around each cluster center.
  // d3-force will relax these into their final positions below.
  clusters.forEach((cl, ci) => {
    cl.members.forEach((m, mi) => {
      const a = rand() * Math.PI * 2;
      const rr = Math.sqrt(rand()) * cl.r;
      const isHub = mi < 2;
      const weight = isHub ? 1 : 0.4 + rand() * 0.4;
      nodes.push({
        id: `${ci}-${mi}`,
        label: m,
        cluster: ci,
        // Color follows extension's D3 schemePaired pattern
        color: clusterColor(cl, isHub),
        // Per-node hue → tints outgoing edges (the extension does this
        // by setting edge.color = `hsl(${node.hue}, 100%, 50%)`).
        hue: cl.hue + (rand() - 0.5) * 18,
        // Seed positions (viewBox space). d3-force expects {x,y} mutable.
        x: cl.cx * 1000 + Math.cos(a) * rr * 600,
        y: cl.cy * 700  + Math.sin(a) * rr * 480,
        // Cluster anchor — used by the cluster-x/y forces.
        cx: cl.cx * 1000,
        cy: cl.cy * 700,
        r: 3 + weight * (isHub ? 6.5 : 3.5),
        weight,
        isHub,
      });
    });
    // Intra-cluster edges (hub → others) — springs to keep clusters tight.
    const clNodes = nodes.filter((n) => n.cluster === ci);
    const hubs = clNodes.filter((n) => n.isHub);
    clNodes.forEach((n) => {
      if (n.isHub) return;
      hubs.forEach((h) => {
        if (rand() < 0.8 * dMul) edges.push({ s: h.id, t: n.id, w: 0.4 });
      });
    });
    for (let i = 0; i < clNodes.length; i++) {
      for (let j = i + 1; j < clNodes.length; j++) {
        if (rand() < 0.18 * dMul) edges.push({ s: clNodes[i].id, t: clNodes[j].id, w: 0.25 });
      }
    }
  });

  // Inter-cluster bridges — the structurally interesting edges.
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

  // Stage 2 — relax with d3.forceSimulation. This is the same physics
  // the Chrome extension uses (extension wraps three-force-graph which
  // wraps d3-force). When d3 isn't loaded we keep the seeded jitter.
  if (typeof window !== "undefined" && window.d3 && window.d3.forceSimulation) {
    const d3 = window.d3;
    // d3 wants {source, target} link refs and will mutate them to point
    // at the actual node objects after the first tick. We map back to
    // {s, t, w} after relaxation so the rest of the file is unchanged.
    const links = edges.map((e) => ({ source: e.s, target: e.t, w: e.w, bridge: e.bridge }));
    const sim = d3.forceSimulation(nodes)
      .force("link",     d3.forceLink(links).id((d) => d.id).distance(48).strength((d) => d.w * 0.7 + 0.2))
      .force("charge",   d3.forceManyBody().strength(-180).distanceMax(380))
      .force("collide",  d3.forceCollide().radius((d) => d.r + 5).iterations(2))
      .force("clusterX", d3.forceX((d) => d.cx).strength(0.16))
      .force("clusterY", d3.forceY((d) => d.cy).strength(0.16))
      .force("center",   d3.forceCenter(500, 350).strength(0.03))
      .alpha(1).alphaDecay(0.04).velocityDecay(0.42)
      .stop();
    // Headless tick to settle the layout.
    const NTICKS = Math.ceil(Math.log(0.001) / Math.log(1 - 0.04));
    for (let i = 0; i < NTICKS; i++) sim.tick();
    // Clamp into viewBox with margin so labels don't get clipped.
    nodes.forEach((n) => {
      n.x = Math.max(40,  Math.min(960, n.x));
      n.y = Math.max(40,  Math.min(660, n.y));
    });
    // Re-emit edges in {s,t,w,bridge} shape with string ids.
    edges.length = 0;
    for (const l of links) {
      const sId = typeof l.source === "object" ? l.source.id : l.source;
      const tId = typeof l.target === "object" ? l.target.id : l.target;
      edges.push({ s: sId, t: tId, w: l.w, bridge: l.bridge });
    }
  }

  // Stage 3 — degree-based size bump (proxy for betweenness; the
  // extension scales node size by actual centrality, but degree
  // approximates well enough for static mockups).
  const deg = {};
  edges.forEach((e) => { deg[e.s] = (deg[e.s] || 0) + 1; deg[e.t] = (deg[e.t] || 0) + 1; });
  const maxDeg = Math.max(1, ...Object.values(deg));
  nodes.forEach((n) => {
    const dn = (deg[n.id] || 0) / maxDeg;
    n.r = n.r + dn * 2.5;          // hubs grow visibly when well-connected
    n.degree = deg[n.id] || 0;
  });

  // Normalize positions back to [0..1] so the rest of the rendering
  // (clusterPath etc.) continues to multiply by W/H.
  nodes.forEach((n) => { n.x = n.x / 1000; n.y = n.y / 700; });

  return { nodes, edges, clusters };
}

// ---- Convex hull + outward inflation + Catmull-Rom smoothing ----
// Wraps every node in a cluster, expanded outward by `padding` units,
// then renders that polygon as a smooth closed Catmull-Rom curve.

// Andrew's monotone-chain convex hull. Stable for collinear input.
function convexHull(points) {
  if (points.length < 3) return points.slice();
  const pts = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (O, A, B) => (A.x - O.x) * (B.y - O.y) - (A.y - O.y) * (B.x - O.x);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop(); lower.pop();
  return lower.concat(upper);
}

// Inflate a CCW hull outward by `pad` along the averaged edge-normal at
// each vertex. Returned polygon stays simple as long as `pad` is < the
// smallest inradius gap, which is true for our cluster spacing.
function inflateHull(hull, pad) {
  const n = hull.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const prev = hull[(i - 1 + n) % n];
    const cur = hull[i];
    const next = hull[(i + 1) % n];
    const e1x = cur.x - prev.x, e1y = cur.y - prev.y;
    const e2x = next.x - cur.x, e2y = next.y - cur.y;
    const l1 = Math.hypot(e1x, e1y) || 1;
    const l2 = Math.hypot(e2x, e2y) || 1;
    // Outward normals for a CCW polygon: rotate edge -90° (y,-x).
    const n1x =  e1y / l1, n1y = -e1x / l1;
    const n2x =  e2y / l2, n2y = -e2x / l2;
    let nx = n1x + n2x, ny = n1y + n2y;
    const nl = Math.hypot(nx, ny) || 1;
    nx /= nl; ny /= nl;
    // Miter length compensates for the angle so corners stay at `pad` distance.
    const dot = Math.max(-0.95, n1x * n2x + n1y * n2y);
    const miter = pad / Math.sqrt((1 + dot) / 2);
    out.push({ x: cur.x + nx * miter, y: cur.y + ny * miter });
  }
  return out;
}

// Closed Catmull-Rom through points, converted to cubic Beziers.
function smoothClosedPath(points, tension = 0.5) {
  const n = points.length;
  if (n === 0) return "";
  if (n === 1) {
    const p = points[0];
    return `M ${p.x} ${p.y}`;
  }
  const k = (1 - tension) / 6;
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    const c1x = p1.x + (p2.x - p0.x) * k;
    const c1y = p1.y + (p2.y - p0.y) * k;
    const c2x = p2.x - (p3.x - p1.x) * k;
    const c2y = p2.y - (p3.y - p1.y) * k;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d + " Z";
}

// Top-level: viewBox-space points → smooth blob path that wraps them.
// pad ≈ max(node.r) + breathing room. For our graph node sizes (≤10),
// 24 reads as a comfortable margin.
function clusterPath(nodes, pad = 24) {
  if (nodes.length === 0) return "";
  if (nodes.length === 1) {
    const p = nodes[0]; const r = pad;
    return `M ${p.x - r} ${p.y} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0 Z`;
  }
  if (nodes.length === 2) {
    // Two points: render a capsule by adding two side-points perpendicular to the segment.
    const [a, b] = nodes;
    const dx = b.x - a.x, dy = b.y - a.y;
    const L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L, ny = dx / L;
    nodes = [
      { x: a.x + nx * 0.5, y: a.y + ny * 0.5 },
      { x: b.x + nx * 0.5, y: b.y + ny * 0.5 },
      { x: b.x - nx * 0.5, y: b.y - ny * 0.5 },
      { x: a.x - nx * 0.5, y: a.y - ny * 0.5 },
    ];
  }
  const hull = convexHull(nodes);
  const inflated = inflateHull(hull, pad);
  return smoothClosedPath(inflated, 0.6);
}

// Axis-aligned bounding box of a point set (viewBox space).
function pointsBBox(pts) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY };
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
  showSpecular = true,       // small white top-left highlight for sprite feel
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

      {/* per-cluster radial gradients & soft glow filter for hulls */}
      <defs>
        <filter id={`hull-glow-${seed}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <filter id={`node-glow-${seed}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
        {clusters.map((cl, ci) => {
          const c = clusterColor(cl, true);
          return (
            <radialGradient key={`hg-${ci}`} id={`hull-grad-${seed}-${ci}`} cx="50%" cy="50%" r="60%">
              <stop offset="0%"   stopColor={c} stopOpacity={variant === "atlas" ? 0.28 : 0.20} />
              <stop offset="55%"  stopColor={c} stopOpacity={variant === "atlas" ? 0.10 : 0.07} />
              <stop offset="100%" stopColor={c} stopOpacity="0" />
            </radialGradient>
          );
        })}
      </defs>

      {/* cluster hulls — convex hull, outward-inflated, Catmull-Rom smoothed */}
      {showHulls && clusters.map((cl, ci) => {
        const clNodes = nodes.filter((n) => n.cluster === ci);
        if (clNodes.length === 0) return null;
        // Match inflation to the largest node in the cluster so the hull
        // hugs every node and gives them visual room to breathe.
        const maxR = clNodes.reduce((m, n) => Math.max(m, n.r), 0);
        const pad = maxR + (variant === "atlas" ? 18 : 14);
        const pts = clNodes.map((n) => ({ x: X(n.x), y: Y(n.y) }));
        const path = clusterPath(pts, pad);
        const bbox = pointsBBox(pts);
        const isHi = highlightCluster === ci;
        return (
          <g key={`hull-${ci}`}>
            {/* outer halo — only on highlight, gives the cluster presence */}
            {isHi && (
              <path
                d={path}
                fill={clusterColor(cl, true)}
                fillOpacity={variant === "atlas" ? 0.16 : 0.12}
                filter={`url(#hull-glow-${seed})`}
              />
            )}
            {/* gradient fill — center-tinted, edges fade to transparent */}
            <path
              d={path}
              fill={`url(#hull-grad-${seed}-${ci})`}
            />
            {/* contour stroke — subtle, no dashes (clean) */}
            <path
              d={path}
              fill="none"
              stroke={clusterColor(cl, true)}
              strokeOpacity={isHi ? 0.55 : 0.22}
              strokeWidth={isHi ? 1.2 : 0.7}
              strokeLinejoin="round"
            />
            {/* cluster name — small mono tag at the top of the hull */}
            <text
              x={bbox.cx}
              y={bbox.minY - pad - 6}
              textAnchor="middle"
              style={{
                fill: clusterColor(cl, true),
                fillOpacity: isHi ? 1 : 0.7,
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                paintOrder: "stroke",
                stroke: "var(--host-bg)",
                strokeWidth: 3,
              }}
            >
              {cl.name}
            </text>
          </g>
        );
      })}

      {/* edges — source-node-hue tinted, depth-cued opacity. Matches the
          Chrome extension's `hsl(node.hue, 100%, 50%)` link coloring. */}
      <g>
        {edges.map((e, i) => {
          const a = byId[e.s], b = byId[e.t];
          if (!a || !b) return null;
          const isFocused = focus && (e.s === focus || e.t === focus);
          const isBridge = e.bridge;
          const baseColor = isFocused
            ? "var(--in-accent)"
            : isBridge
              ? "var(--c-magenta)"
              : `hsl(${Math.round(a.hue)}, 65%, ${variant === "atlas" ? 64 : 56}%)`;
          const w = isFocused ? 1.6 : isBridge ? 0.9 : 0.55 + (e.w || 0.3) * 0.7;
          const op = focus
            ? (isFocused ? 0.95 : 0.10)
            : isBridge ? 0.7
            : (variant === "atlas" ? 0.55 : 0.42);
          return (
            <line
              key={i}
              x1={X(a.x)} y1={Y(a.y)} x2={X(b.x)} y2={Y(b.y)}
              stroke={baseColor}
              strokeWidth={w}
              strokeOpacity={op}
              strokeLinecap="round"
              strokeDasharray={isBridge && variant === "topology" ? "2 3" : "0"}
            />
          );
        })}
      </g>

      {/* nodes — halo + main circle + subtle specular highlight for the
          three-dimensional "sprite" look from the extension's WebGL render. */}
      <g>
        {nodes.map((n) => {
          const dim = focus && focus !== n.id;
          // Larger halo for hubs, smaller for satellites — emulates
          // the extension's betweenness-driven sprite scaling.
          const haloR = n.r + (n.isHub ? 6 : 2.5);
          return (
            <g key={n.id} opacity={dim ? 0.30 : 1}>
              {/* depth halo */}
              <circle
                cx={X(n.x)} cy={Y(n.y)} r={haloR}
                fill={n.color}
                opacity={n.isHub ? 0.32 : 0.16}
                filter={`url(#node-glow-${seed})`}
              />
              {/* main */}
              <circle
                className="node"
                cx={X(n.x)} cy={Y(n.y)} r={n.r}
                fill={n.color}
                stroke="var(--host-bg)"
                strokeWidth={variant === "topology" ? 1.1 : 0.7}
              />
              {/* specular highlight — small white circle offset to top-left
                  fakes a light source, the same trick three-spritetext gives
                  "for free" via WebGL shading. */}
              {showSpecular && (
                <circle
                  cx={X(n.x) - n.r * 0.30} cy={Y(n.y) - n.r * 0.35}
                  r={n.r * 0.42}
                  fill="#ffffff"
                  opacity={0.18}
                  pointerEvents="none"
                />
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

// ============================================================
// CompareGraph — visualizes set operations between two text graphs
// (overlap / difference). Unlike two random ForceGraphs side-by-side,
// this builds ONE shared layout where nodes are tagged by membership
// (a-only / shared / b-only) so the result actually shows what was
// computed. Used by overlap_between_texts and difference_between_texts.
// ============================================================

const _COMPARE_LAYOUT = {
  // Three zones laid out left → right. A-only and B-only sit on either side;
  // shared concepts sit in a tighter central column. Hulls computed from
  // these positions wrap them organically — no static decorative ellipses.
  zones: [
    { key: "a-only", cx: 0.24, cy: 0.50, rx: 0.13, ry: 0.32,
      members: ["modularity", "betweenness", "centrality", "vertex", "pagerank", "cluster", "hub", "diameter"] },
    { key: "shared", cx: 0.50, cy: 0.50, rx: 0.07, ry: 0.24,
      members: ["concept", "graph", "embedding", "ontology", "context", "token"] },
    { key: "b-only", cx: 0.76, cy: 0.50, rx: 0.13, ry: 0.32,
      members: ["vector retrieval", "rerank", "chunking", "rrf fusion", "hybrid search", "synthetic q&a", "vector db"] },
  ],
};

function _buildCompareNodes() {
  const rand = mulberry32(42);
  const nodes = [];
  _COMPARE_LAYOUT.zones.forEach((z) => {
    z.members.forEach((label, i) => {
      const a = rand() * Math.PI * 2;
      const r2 = Math.sqrt(rand()) * 0.78;
      // Sample inside an ellipse; squash so points avoid the dead-center for the wide zones
      const ox = Math.cos(a) * r2 * z.rx * 0.92;
      const oy = Math.sin(a) * r2 * z.ry * 0.92;
      nodes.push({
        id: `${z.key}-${i}`,
        label,
        kind: z.key,
        x: z.cx + ox,
        y: z.cy + oy,
        r: 4 + rand() * 4,
        isHub: i < 2,
      });
    });
  });
  // Edges: dense within each zone, plus shared→a and shared→b bridges
  const edges = [];
  const r2 = mulberry32(99);
  _COMPARE_LAYOUT.zones.forEach((z) => {
    const zn = nodes.filter((n) => n.kind === z.key);
    for (let i = 0; i < zn.length; i++) {
      for (let j = i + 1; j < zn.length; j++) {
        if (r2() < 0.35) edges.push({ s: zn[i].id, t: zn[j].id, kind: z.key });
      }
    }
  });
  // Cross-edges: shared nodes bridge into A and B
  const shared = nodes.filter((n) => n.kind === "shared");
  const aOnly = nodes.filter((n) => n.kind === "a-only");
  const bOnly = nodes.filter((n) => n.kind === "b-only");
  shared.forEach((sn, i) => {
    const a1 = aOnly[i % aOnly.length];
    const a2 = aOnly[(i + 3) % aOnly.length];
    const b1 = bOnly[i % bOnly.length];
    const b2 = bOnly[(i + 2) % bOnly.length];
    if (a1) edges.push({ s: sn.id, t: a1.id, kind: "a-bridge" });
    if (r2() < 0.5 && a2) edges.push({ s: sn.id, t: a2.id, kind: "a-bridge" });
    if (b1) edges.push({ s: sn.id, t: b1.id, kind: "b-bridge" });
    if (r2() < 0.5 && b2) edges.push({ s: sn.id, t: b2.id, kind: "b-bridge" });
  });
  return { nodes, edges };
}

// Pre-computed once (deterministic).
const _COMPARE = _buildCompareNodes();

const _COMPARE_STYLES = {
  overlap: {
    "a-only":  { color: "var(--c-orange)",  op: 0.32, size: 0.85, label: 0.5 },
    "shared":  { color: "var(--c-lime)",    op: 1.00, size: 1.30, label: 1.0, glow: true },
    "b-only":  { color: "var(--c-magenta)", op: 0.32, size: 0.85, label: 0.5 },
  },
  "diff-ba": { // what's in B that isn't in A
    "a-only":  { color: "var(--host-fg-3)", op: 0,    size: 0.5,  label: 0 },
    "shared":  { color: "var(--host-fg-3)", op: 0.28, size: 0.7,  label: 0.4 },
    "b-only":  { color: "var(--c-magenta)", op: 1.00, size: 1.25, label: 1.0, glow: true },
  },
};

function _edgeStyle(mode, kind) {
  if (mode === "overlap") {
    if (kind === "shared")   return { color: "var(--c-lime)",    op: 0.85, w: 1.4 };
    if (kind === "a-only")   return { color: "var(--c-orange)",  op: 0.28, w: 0.5 };
    if (kind === "b-only")   return { color: "var(--c-magenta)", op: 0.28, w: 0.5 };
    if (kind === "a-bridge") return { color: "var(--c-lime)",    op: 0.35, w: 0.5 };
    if (kind === "b-bridge") return { color: "var(--c-lime)",    op: 0.35, w: 0.5 };
  }
  if (mode === "diff-ba") {
    if (kind === "a-only")   return { op: 0 };
    if (kind === "a-bridge") return { op: 0 };
    if (kind === "shared")   return { color: "var(--host-fg-3)", op: 0.20, w: 0.4 };
    if (kind === "b-only")   return { color: "var(--c-magenta)", op: 0.85, w: 1.1 };
    if (kind === "b-bridge") return { color: "var(--c-magenta)", op: 0.45, w: 0.7 };
  }
  return { op: 0 };
}

function CompareGraph({
  mode = "overlap",       // "overlap" | "diff-ba"
  showLabels = "all",     // "all" | "hubs" | "none"
  showHulls = true,       // draw the set hulls (computed from node positions)
  className = "",
  style,
}) {
  const { nodes, edges } = _COMPARE;
  const W = 1000, H = 700;
  const X = (v) => v * W, Y = (v) => v * H;
  const byId = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);

  // Hulls are computed from where the nodes actually are, NOT static
  // decorative ellipses. The A hull wraps all A members (a-only + shared);
  // the B hull wraps all B members (b-only + shared); the shared hull
  // wraps just the intersection. Overlap is therefore an emergent
  // property of the geometry, not a fixed prop.
  const xy = (n) => ({ x: X(n.x), y: Y(n.y) });
  const aPts      = useMemo(() => nodes.filter((n) => n.kind === "a-only" || n.kind === "shared").map(xy), [nodes]);
  const bPts      = useMemo(() => nodes.filter((n) => n.kind === "b-only" || n.kind === "shared").map(xy), [nodes]);
  const sharedPts = useMemo(() => nodes.filter((n) => n.kind === "shared").map(xy), [nodes]);

  const padOuter = 32, padInner = 18;
  const aPath      = useMemo(() => clusterPath(aPts, padOuter), [aPts]);
  const bPath      = useMemo(() => clusterPath(bPts, padOuter), [bPts]);
  const sharedPath = useMemo(() => clusterPath(sharedPts, padInner), [sharedPts]);

  const aBBox      = useMemo(() => pointsBBox(aPts), [aPts]);
  const bBBox      = useMemo(() => pointsBBox(bPts), [bPts]);
  const sharedBBox = useMemo(() => pointsBBox(sharedPts), [sharedPts]);

  // Per-mode visual treatment of the three hulls.
  const treat = mode === "overlap"
    ? {
        a:      { fill: `url(#cmp-grad-a-${mode})`,      stroke: "var(--c-orange)",  sOp: 0.45, sW: 0.8, dash: "0",   labelOp: 1 },
        b:      { fill: `url(#cmp-grad-b-${mode})`,      stroke: "var(--c-magenta)", sOp: 0.45, sW: 0.8, dash: "0",   labelOp: 1 },
        shared: { fill: `url(#cmp-grad-shared-${mode})`, stroke: "var(--c-lime)",    sOp: 0.7,  sW: 1.0, dash: "0",   labelOp: 1 },
      }
    : { // diff-ba: A becomes a dotted ghost, B becomes the focal solid, shared dimmed inside
        a:      { fill: "transparent",                   stroke: "var(--host-fg-3)", sOp: 0.45, sW: 0.6, dash: "4 6", labelOp: 0.55 },
        b:      { fill: `url(#cmp-grad-b-${mode})`,      stroke: "var(--c-magenta)", sOp: 0.6,  sW: 1.0, dash: "0",   labelOp: 1 },
        shared: { fill: "transparent",                   stroke: "var(--host-fg-3)", sOp: 0.18, sW: 0.5, dash: "0",   labelOp: 0.45 },
      };

  return (
    <svg className={`graph-svg ${className}`} viewBox={`0 0 ${W} ${H}`} style={style} preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id={`cmp-grad-a-${mode}`} cx="50%" cy="50%" r="60%">
          <stop offset="0%"   stopColor="var(--c-orange)" stopOpacity="0.22" />
          <stop offset="55%"  stopColor="var(--c-orange)" stopOpacity="0.09" />
          <stop offset="100%" stopColor="var(--c-orange)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`cmp-grad-b-${mode}`} cx="50%" cy="50%" r="60%">
          <stop offset="0%"   stopColor="var(--c-magenta)" stopOpacity={mode === "diff-ba" ? 0.30 : 0.22} />
          <stop offset="55%"  stopColor="var(--c-magenta)" stopOpacity={mode === "diff-ba" ? 0.12 : 0.09} />
          <stop offset="100%" stopColor="var(--c-magenta)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`cmp-grad-shared-${mode}`} cx="50%" cy="50%" r="60%">
          <stop offset="0%"   stopColor="var(--c-lime)" stopOpacity="0.32" />
          <stop offset="55%"  stopColor="var(--c-lime)" stopOpacity="0.14" />
          <stop offset="100%" stopColor="var(--c-lime)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Hulls — drawn back-to-front so the intersection layers visually
          over the A and B sets, matching how Venn diagrams read. */}
      {showHulls && (
        <g>
          <path d={aPath} fill={treat.a.fill} stroke={treat.a.stroke}
            strokeOpacity={treat.a.sOp} strokeWidth={treat.a.sW}
            strokeDasharray={treat.a.dash} strokeLinejoin="round" />
          <path d={bPath} fill={treat.b.fill} stroke={treat.b.stroke}
            strokeOpacity={treat.b.sOp} strokeWidth={treat.b.sW}
            strokeDasharray={treat.b.dash} strokeLinejoin="round" />
          {/* Shared hull is meaningful in overlap mode; in diff-ba it's
              just a faint dotted reminder that this region was subtracted. */}
          <path d={sharedPath} fill={treat.shared.fill} stroke={treat.shared.stroke}
            strokeOpacity={treat.shared.sOp} strokeWidth={treat.shared.sW}
            strokeDasharray={treat.shared.dash} strokeLinejoin="round" />

          {/* Set tags, positioned above each hull's actual bounding box. */}
          <text x={aBBox.minX - padOuter + 4} y={aBBox.minY - padOuter - 8}
            fill="var(--c-orange)" fillOpacity={treat.a.labelOp}
            fontFamily="var(--font-mono)" fontSize="13" letterSpacing="0.08em"
            style={{ paintOrder: "stroke", stroke: "var(--host-bg)", strokeWidth: 3 }}>
            A
          </text>
          <text x={bBBox.maxX + padOuter - 4} y={bBBox.minY - padOuter - 8}
            fill="var(--c-magenta)" fillOpacity={treat.b.labelOp}
            fontFamily="var(--font-mono)" fontSize="13" letterSpacing="0.08em"
            textAnchor="end"
            style={{ paintOrder: "stroke", stroke: "var(--host-bg)", strokeWidth: 3 }}>
            B
          </text>
          {mode === "overlap" && (
            <text x={sharedBBox.cx} y={sharedBBox.minY - padInner - 8}
              fill="var(--c-lime)" fontFamily="var(--font-mono)" fontSize="11"
              letterSpacing="0.08em" textAnchor="middle"
              style={{ paintOrder: "stroke", stroke: "var(--host-bg)", strokeWidth: 3 }}>
              A ∩ B
            </text>
          )}
          {mode === "diff-ba" && (
            <text x={bBBox.cx} y={bBBox.maxY + padOuter + 14}
              fill="var(--c-magenta)" fontFamily="var(--font-mono)" fontSize="11"
              letterSpacing="0.08em" textAnchor="middle"
              style={{ paintOrder: "stroke", stroke: "var(--host-bg)", strokeWidth: 3 }}>
              B − A
            </text>
          )}
        </g>
      )}

      {/* Edges */}
      <g>
        {edges.map((e, i) => {
          const a = byId[e.s], b = byId[e.t];
          if (!a || !b) return null;
          const es = _edgeStyle(mode, e.kind);
          if (!es.color || es.op === 0) return null;
          return (
            <line key={i}
              x1={X(a.x)} y1={Y(a.y)} x2={X(b.x)} y2={Y(b.y)}
              stroke={es.color} strokeWidth={es.w}
              strokeOpacity={es.op} />
          );
        })}
      </g>

      {/* Nodes */}
      <g>
        {nodes.map((n) => {
          const s = _COMPARE_STYLES[mode][n.kind];
          if (!s || s.op === 0) return null;
          return (
            <g key={n.id} opacity={s.op} style={{ color: s.color }}>
              {s.glow && (
                <circle cx={X(n.x)} cy={Y(n.y)} r={n.r * s.size + 5} fill={s.color} opacity="0.22" />
              )}
              <circle cx={X(n.x)} cy={Y(n.y)} r={n.r * s.size}
                fill={s.color} stroke="var(--host-bg)" strokeWidth="1.1" />
            </g>
          );
        })}
      </g>

      {/* Labels */}
      <g>
        {nodes.map((n) => {
          if (showLabels === "none") return null;
          const s = _COMPARE_STYLES[mode][n.kind];
          if (!s || s.label === 0) return null;
          const isShared = n.kind === "shared";
          if (showLabels === "hubs" && !isShared && !n.isHub) return null;
          return (
            <text key={`l-${n.id}`}
              className="label"
              x={X(n.x) + n.r + 4} y={Y(n.y) + 3}
              opacity={s.label}
              style={{
                fill: isShared ? "var(--host-fg)" : "var(--host-fg-3)",
                fontWeight: isShared ? 600 : 400,
                fontSize: isShared ? 11 : 9,
              }}>
              {n.label}
            </text>
          );
        })}
      </g>
    </svg>
  );
}

Object.assign(window, { ForceGraph, MiniGraph, CompareGraph, buildGraph });
