# InfraNodus MCP App — `design.md`

> A design specification for **`infranodus-mcp-app`** — an MCP App (per the
> `apps/2026-01-26` spec) that brings InfraNodus's network-thinking experience
> into MCP-compatible hosts. This document is the source of truth for
> tokens, components, layouts, motion, and tool-side contracts.
>
> **Status:** v0.1 — design proposal · two directions (`Topology`, `Atlas`)
> **Companion artifact:** `mockups.html` (interactive Figma-style canvas)
> **Repo target:** `Zpankz/infranodus-mcp-app`

---

## 0. Premise

InfraNodus turns text into a knowledge graph: concepts become nodes, their
co-occurrence becomes edges, communities emerge as clusters, and **structural
gaps** between clusters become creative prompts.

An MCP host (Claude Desktop, Goose, etc.) talks to an MCP server via tools and
resources. **MCP Apps** add a UI surface: when a tool call returns, the host can
embed an `application/vnd.mcp.app+html` payload in an iframe and the app gets a
live channel (`window.mcp`) to call further tools, read context, and react to
host events.

This spec defines an app that:

1. **Renders the graph** the MCP server returns — beautifully, interactively.
2. **Lets the user query in natural language**; the app compiles that to MCP
   tool calls against the InfraNodus MCP server.
3. **Surfaces structural insight** — top topics, bridging concepts, and gaps.
4. **Embeds gracefully** inside any host that follows the apps spec — light or
   dark, narrow or wide, with or without `safeAreaInsets`.

---

## 1. Brand & voice

| Axis | Direction |
|---|---|
| **Personality** | Quiet instrument · senior researcher's notebook · network science with taste |
| **Tone of voice** | Direct, declarative, evidence-led. "Three communities. One bridge to grow." Not "Discover insights!" |
| **Visual DNA** | Force-directed graph, hub/satellite typography, cluster hulls, single warm accent against cool neutrals |
| **Anti-patterns** | No glossy gradients, no decorative iconography, no over-rounded chips, no rainbow palettes outside the cluster legend |

The MCP app is a **sibling** of the InfraNodus web app and Obsidian plugin —
same family, original layout vocabulary tuned for the constraints of an MCP
host iframe (small viewport, host-controlled chrome, tool/resource lifecycle).

---

## 2. Design tokens

All tokens prefer the host's CSS variables and fall back to baked-in values.
This is non-negotiable — the apps spec requires that hosts can theme us.

```css
:root {
  /* Surfaces */
  --host-bg:       var(--color-background-primary,   oklch(0.135 0.006 250));
  --host-bg-2:     var(--color-background-secondary, oklch(0.165 0.006 250));
  --host-bg-3:     var(--color-background-tertiary,  oklch(0.195 0.006 250));

  /* Foreground */
  --host-fg:       var(--color-text-primary,         oklch(0.965 0.003 250));
  --host-fg-2:     var(--color-text-secondary,       oklch(0.74  0.005 250));
  --host-fg-3:     var(--color-text-tertiary,        oklch(0.56  0.006 250));

  /* Lines */
  --host-border:   var(--color-border-primary,       oklch(0.28  0.006 250));
  --host-border-2: var(--color-border-secondary,     oklch(0.235 0.006 250));

  /* Type */
  --font-ui:       var(--font-sans, "Inter", system-ui, sans-serif);
  --font-mono:     var(--font-mono, "JetBrains Mono", ui-monospace, monospace);

  /* Brand */
  --in-accent:     oklch(0.74 0.155 52);     /* InfraNodus signal-orange */
  --in-accent-soft:oklch(0.74 0.155 52 / 0.12);
  --in-accent-line:oklch(0.74 0.155 52 / 0.32);

  /* Cluster palette — chroma 0.14, L 0.74 (matched) */
  --c-orange:  oklch(0.74 0.155 52);
  --c-cyan:    oklch(0.74 0.13  205);
  --c-violet:  oklch(0.74 0.14  290);
  --c-lime:    oklch(0.80 0.14  140);
  --c-magenta: oklch(0.74 0.16  340);
  --c-blue:    oklch(0.74 0.13  240);
}
```

### Type scale

| Token | Size | Use |
|---|---|---|
| `--t-12` | 12px | mono labels, captions, kbd |
| `--t-13` | 13px | secondary body, tool args |
| `--t-14` | 14px | body, default UI |
| `--t-16` | 16px | callout, AI summary |
| `--t-20` | 20px | stat numbers, panel titles |
| `--t-28` | 28px | page hero |
| `--t-36` | 36px | onboarding hero only |

Headings use **JetBrains Mono** at `font-weight: 500` for that
researcher-notebook feel; body uses **Inter** at 400/500/600.

### Radii

`--r-xs:2 · --r-sm:4 · --r-md:6 · --r-lg:10 · --r-xl:14 · --r-2xl:20`

- **Direction A (Topology)** uses `--r-md` (6) for cards, `--r-sm` (4) for chips.
- **Direction B (Atlas)** uses `--r-xl` (14) for cards, `999` (pill) for chips
  and the query bar.

### Spacing

`4 · 6 · 8 · 10 · 12 · 14 · 18 · 22 · 28 · 32`

No tailwind defaults. Density is part of the brand — Topology is tight, Atlas
is generous, both use the same scale.

### Status colors

- `--ok` `oklch(0.78 0.14 150)` — tool completed
- `--warn` `oklch(0.80 0.14 80)` — tool running
- `--err` `oklch(0.70 0.18 25)` — tool failed

---

## 3. Two design directions

Both directions ship in the same codebase, switchable via the **Tweaks** panel.
They share tokens, graph engine, copy, information architecture. They differ in
chrome density, radii, and graph treatment.

### A. Topology — terminal/dev-tool

- Single warm accent against cool neutrals.
- Mono headers in `--host-fg-3`, uppercase, 0.06em tracking.
- 4–6px radii. Sharp lines, faint grid behind the graph.
- Dense panels: graph + sidebar + bottom query bar (3-pane).
- **Best for:** Claude Desktop alongside code, Goose, Obsidian when paired
  with the existing InfraNodus Obsidian plugin.

### B. Atlas — graph-first canvas

- Full-bleed graph; chrome floats on top of it with `backdrop-filter: blur`.
- Multi-cluster colors prominent; node halos and soft glow.
- 14–24px radii; pill query bar; cards have generous padding.
- **Best for:** standalone usage, presentations, marketing demos, and hosts
  with larger iframe real-estate.

---

## 4. Information architecture

Five surfaces. Each one is also addressable as an MCP `resource` so the host
can deep-link, and as a tool `output` so a tool call can render directly into it.

| # | Surface | URI scheme | Default tool that opens it |
|---|---|---|---|
| 01 | **Graph canvas** | `graph://<id>` | `analyzeText`, `openGraph` |
| 02 | **Query compiler** | `graph://<id>/query` | `composeQuery` |
| 03 | **Insights & gaps** | `graph://<id>/insights` | `findGaps`, `summarize` |
| 04 | **Resource browser** | `graphs://` | `listGraphs` |
| 05 | **Onboarding** | `app://onboard` | first-run, no graph in context |

The host's URL bar (if it surfaces one) shows the URI. The app reads it from
`window.mcp.context.resourceUri` and routes accordingly.

---

## 5. The Graph component

The graph is the product. Everything else is scaffolding.

### 5.1 Data model

```ts
type Node = {
  id: string;
  label: string;
  cluster: string;        // cluster id
  weight: number;         // 0..1 → radius via r = 3 + weight * 6.5
  isHub: boolean;         // top-N by pagerank in cluster
  x?: number; y?: number; // optional layout hint (server-side or cached)
};

type Edge = {
  source: string;
  target: string;
  weight: number;         // 0..1 → opacity & width
  bridge?: boolean;       // crosses cluster boundary
};

type Cluster = {
  id: string;
  label: string;          // human, e.g. "knowledge graph"
  color: string;          // assigned from cluster palette
  members: string[];      // node ids
};
```

### 5.2 Layout

Server-side force layout (d3-force or InfraNodus's existing engine) computes
positions; the client receives `{nodes, edges, clusters}` with positions in
`[0, 1]` space and renders deterministically. On `tools/list` change or on
user-driven mutation, the server recomputes and streams the delta.

### 5.3 Interactions

| Interaction | Behavior |
|---|---|
| **Hover node** | Dim non-neighbors to 0.35 · highlight incident edges in `--in-accent` · show tooltip with degree, cluster, AI excerpt |
| **Click node** | Focus mode: pin highlight, open right-side detail card |
| **Drag node** | Smooth physics (velocity-Verlet, friction 0.85) — releases settle the local sub-graph |
| **Click cluster hull** | Zoom-to-fit cluster · semantic label fades in at ≥1.5× zoom |
| **Lasso (shift-drag)** | Selects nodes, opens "Ask the graph about…" composer |
| **Scroll wheel** | Zoom around cursor (range 0.4× → 4×) |
| **Two-finger drag / space-drag** | Pan |
| **Right-click** | Context menu: pin, expand, hide, copy-as-prompt |
| **Long-hover (600ms)** | AI tooltip — 1–2 sentences from `tools/call summarizeNode` |

### 5.4 Visual variants

- **Topology**: nodes are filled circles with 1.2px host-bg stroke; edges
  hairline (0.5px) in `--host-border`; bridge edges dashed in `--c-magenta`.
- **Atlas**: nodes have a soft `drop-shadow(0 0 8px currentColor)`; hubs get an
  extra 4px halo at 15% opacity; edges at 0.45 opacity.

### 5.5 Labels

Tweakable: `none | hubs | all`. Labels are paint-order-stroked in `--host-bg`
so they remain legible over edges. Atlas uses sans-serif labels at 11px;
Topology uses mono at 10px.

---

## 6. Natural-language query

The signature interaction. The user types in plain English; the app compiles
it to one or more MCP tool calls, runs them, and renders the result.

### 6.1 Compilation flow

```
[user input] → claude.complete(promptCompile)
            ↘
              { plan: [
                  { tool: "infranodus.findBridges",
                    args: { a, b, metric: "betweenness", top: 6 } },
                  { tool: "infranodus.expandConcept",
                    args: { id: "embedding", hop: 2 } },
                  { tool: "infranodus.summarizeCluster",
                    args: { cluster: "discourse" } },
                ],
                speak: "showing top bridges and expanding embedding…"
              }
            ↘
              window.mcp.callTool(...) ×N (parallel where possible)
            ↘
              renderResult(structuredContent)
```

Compile runs locally via `window.claude.complete` (haiku, 1024 tokens) so it's
fast and free. The compiled plan is shown before execution — the user can
edit any arg or drop a step.

### 6.2 Concept chips

Recognized concepts get colored chips matching their cluster. Verbs (`bridge`,
`compare`, `rank by`, `expand`) get the accent treatment. Numbers and metric
names get `--c-lime`. This is just type styling, no separate widget needed.

### 6.3 Recipes

Frequent query shapes can be saved as **recipes** — a recipe is just a named
prompt template. Recipes ship as MCP **prompts** on the server side, so they're
discoverable by the host's prompt picker too.

---

## 7. Insights surface

Tiles, in order:

1. **Six-up metric row**: nodes, edges, clusters, modularity, bridges, gaps.
2. **AI summary** — `tools/call summarize` against the whole graph.
3. **Live mini-graph** preview.
4. **Top topics** — pagerank bars per concept, colored by cluster.
5. **Structural gaps** — pairs of clusters with low connectivity + a rationale
   sentence + a "Bridge" action that drafts the bridge concept and shows a
   preview edge in the canvas.
6. **Graph diagnostics** — density, avg degree, diameter, clustering coefficient,
   connected components, entropy. Mono, two-column.
7. **Follow-ups** — 4–6 suggested next queries; tap to compose.

Every numeric value links to the underlying `tools/call` so the user can
inspect the math.

---

## 8. Resource browser

A graph is a first-class MCP resource. The browser lists every graph the
server exposes:

- 3-column grid (Atlas) or row table (Topology).
- Each card shows: name, mini-graph preview (sparse layout, no labels),
  node count, cluster count, last-updated.
- Search filters by name, tag, or **concept** — typing "ontology" surfaces
  every graph containing that node.
- "Import" opens the `resources/templates` flow: paste URL, drop file, paste text.

The mini-graph previews use the **same** `<ForceGraph>` component at `seed`
keyed off the graph id, so they're stable across reloads.

---

## 9. Onboarding

Two variants:

- **Topology**: subtle background graph at 18% opacity; left-aligned heading
  set in mono; numbered three-step flow; two CTAs.
- **Atlas**: foregrounded background graph with radial vignette; centered
  card with 4-up choice grid (Paste / Connect / Recent / Sample).

Default copy:

> **Topology:** "Turn any conversation into a knowledge graph."
> **Atlas:** "See the shape of what you're thinking."

The onboarding never renders if the host already has a `resourceUri` in
context — we route straight to the matching surface.

---

## 10. Component reference

| Component | Purpose | Props |
|---|---|---|
| `<AppBar>` | Top chrome, breadcrumb, connection pill | `variant`, `crumbs[]` |
| `<ForceGraph>` | The graph viz | `seed`, `density`, `variant`, `showLabels`, `focus`, `highlightCluster`, `showHulls`, `showAxis` |
| `<MiniGraph>` | Compact graph for cards/rows | `seed`, `variant` |
| `<ClusterList>` | Sidebar legend | `highlighted` |
| `<GapList>` / `<GapCard>` / `<AtlasGapCard>` | Bridge opportunities | `a`, `b`, `rationale` |
| `<ToolCall>` / `<CallChip>` | Compiled MCP call preview | `name`, `args`, `status`, `t` |
| `<TopicRow>` / `<BridgeRow>` | Ranked concept rows | `rank`, `label`, `color`, `v` |
| `<Stat>` / `<Metric>` | Numeric tile | `n`/`v`, `l`/`k` |
| `<SuggRow>` / `<Suggest>` | Follow-up query suggestion | `q` |
| `<Step>` / `<ChoiceCard>` | Onboarding bits | `n`, `t` / `tone`, `title`, `sub` |

---

## 11. Motion

- **Hover dim**: opacity 1 → 0.35 · 180ms · `cubic-bezier(0.2, 0.7, 0.2, 1)`
- **Focus zoom**: 320ms · `cubic-bezier(0.32, 0.72, 0, 1)` (gentle overshoot)
- **Cluster label fade-in at zoom**: 220ms · ease-out, threshold 1.5× scale
- **Panel reveal**: 220ms · translateY(6px) → 0, opacity 0 → 1
- **No bounce** anywhere — InfraNodus is precise, not playful.

Atlas adds:

- **Node halo pulse** on hub click: 600ms · scale 1 → 1.4 · opacity 1 → 0,
  uses `prefers-reduced-motion` to short-circuit.

---

## 12. MCP surface contract

Per `specification/2026-01-26/apps.mdx`, our server returns tool results with
an `application/vnd.mcp.app+html` content block pointing at the app bundle.

### 12.1 Tools (declared on the InfraNodus MCP server)

| Tool | Purpose | Renders into |
|---|---|---|
| `analyzeText` | Build a graph from a blob of text | 01 Graph canvas |
| `openGraph` | Open a saved graph by id | 01 Graph canvas |
| `composeQuery` | Compile NL → plan; **does not execute** | 02 Query compiler |
| `runQueryPlan` | Execute a plan from `composeQuery` | 01 (focused) / 03 |
| `findBridges` | Bridging concepts between two clusters | inline (graph delta) |
| `expandConcept` | k-hop neighborhood around a concept | inline |
| `summarize` | AI summary of a graph or cluster | 03 (or AI tooltip) |
| `findGaps` | List structural gaps with rationales | 03 Insights & gaps |
| `listGraphs` | Available saved graphs | 04 Resource browser |
| `diff` | Compare two graphs / two times | 03 (diff panel) |

### 12.2 Resources

- `graph://<id>` — the materialized graph (JSON), large; streamed.
- `graph://<id>/summary` — short text, cached.
- `graphs://` — listing.

### 12.3 Host channel (`window.mcp`)

The app:

```js
// On mount
const ctx = await window.mcp.context();
// → { resourceUri, theme: "dark"|"light", host: { name, version }, safeAreaInsets }

window.mcp.on("contextchanged", ({ theme }) => applyTheme(theme));
window.mcp.on("toolresult", ({ tool, structuredContent }) => route(tool, structuredContent));

// Compose & dispatch
await window.mcp.callTool("findBridges", { a, b, metric, top });

// Cross-call hint
window.mcp.suggestPrompt("explain why embedding is the top bridge");
```

A `composeQuery` tool result is always shown in the Query Compiler surface so
the user can edit before `runQueryPlan` fires.

### 12.4 Display modes

The app honors:

- `displayMode: "inline"` — height auto, no canvas chrome, no onboarding.
- `displayMode: "fullscreen"` — full viewport, all chrome on, Tweaks available.

In inline mode we drop the AppBar and bottom query bar; just the graph + a
single floating "Open in app" affordance.

---

## 13. Skills mapping

The user's three reference skills map cleanly onto the spec:

- **`SKILL-2` (add-app-to-server)** — what the InfraNodus MCP server team does
  to expose the tools above with `application/vnd.mcp.app+html` outputs
  pointing at this app's bundle.
- **`SKILL-3` (convert-web-app)** — guides the port of selected
  `infranodus.com` features into MCP tool/app pairs (analyze, gaps, summary,
  bridges). The web app's "Insights" tab maps to surface **03**; the canvas to
  **01**; the dashboard to **04**.
- **`SKILL` (general patterns)** — followed for the host channel, theming via
  `--color-*`, `safeAreaInsets`, and CSP-safe asset bundling.

---

## 14. Accessibility

- Type minimum: **13px** body; **11px** mono captions are bold and well-spaced.
- Color is **never** the only channel: clusters carry both color *and* a 2-char
  mono tag (e.g. `KG`, `LM`, `DS`) in the legend.
- Focus rings: 2px solid `--in-accent` with `outline-offset: 2px`.
- The graph is keyboard-navigable: arrow keys cycle hubs; enter focuses;
  escape clears. Tab order: AppBar → Graph (nodes as a virtual list) →
  Sidebar → Query.
- `prefers-reduced-motion` disables the halo pulse and the focus-zoom overshoot.
- Screen readers get a textual summary as an aria-live region whenever the
  graph state changes ("142 nodes, 5 clusters; top topic: knowledge graph").

---

## 15. Performance budgets

| Metric | Budget |
|---|---|
| First paint (inside iframe) | < 600ms |
| Graph render (≤ 500 nodes) | < 250ms |
| Hover dim/highlight | 1 frame |
| Compile + run query plan | < 1.4s p50 |
| Bundle (gzipped) | < 220 KB |

The graph engine is canvas-or-SVG hybrid: ≤ 500 nodes → SVG (current);
> 500 → canvas with WebGL outline.

---

## 16. Tweaks

The Tweaks panel exposes:

- **Theme** — dark / light.
- **Accent** — 4 curated swatches (signal-orange default; cobalt, iris,
  filament alternatives — all matched chroma/lightness).
- **Density** — sparse / balanced / dense (changes graph generation, not UI
  padding).
- **Labels** — none / hubs / all.
- **Layout** — split-view / full-canvas.
- **Type scale** — 0.85× – 1.20× in 5% steps.

Tweaks persist via the host's `__edit_mode_set_keys` protocol; they round-trip
through the `EDITMODE` block at the top of `app.jsx`.

---

## 17. Out of scope (v0.1)

- Real-time multi-user editing.
- Graph diffing UI past the simple two-snapshot case.
- Native canvas/WebGL renderer (planned post-500-node).
- Direct file uploads (the host owns auth and IO).

---

## 18. Open questions

1. Do we ship the **Topology** or **Atlas** variant as default? My
   recommendation: ship **both**, default to Atlas in fullscreen, Topology in
   inline mode.
2. The cluster auto-naming model — local (haiku via `window.claude.complete`)
   or server-side via the MCP server? Server-side is more consistent across
   hosts but adds a tool call to every analysis.
3. How do we represent **uncertainty** in bridge suggestions? Today: just the
   rationale sentence. Future: a small confidence bar.

---

*Last touched · v0.1*
