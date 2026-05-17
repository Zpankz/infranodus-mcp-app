# InfraNodus MCP App — Implementation Specification

## Architecture

Follows **SKILL-2 pattern** (add-app-to-server): existing InfraNodus MCP server tools
get paired with an interactive graph visualization UI resource.

Additionally uses **SKILL-3 pattern** (convert-web-app): the graph viewer works both
as a standalone web page (with URL param data source) and as an MCP App iframe
(receiving data via postMessage JSON-RPC).

```
┌─────────────────────────────────────────────────────────────┐
│ MCP Host (Claude Desktop / claude.ai)                       │
│                                                             │
│  ┌──────────────┐    ┌──────────────────────────────────┐  │
│  │ MCP Server   │    │ MCP App (sandboxed iframe)        │  │
│  │              │    │                                    │  │
│  │ Tools:       │───▶│ ui://infranodus/graph-viewer      │  │
│  │  - generate_ │    │                                    │  │
│  │    knowledge │    │  ┌────────────────────────────┐   │  │
│  │    _graph    │    │  │ Sigma.js + Graphology      │   │  │
│  │  - get_graph │    │  │ Force-directed layout      │   │  │
│  │  - analyze_  │    │  │ Community coloring         │   │  │
│  │    graph     │    │  │ Gap highlighting           │   │  │
│  │  - search_   │    │  │ Interactive tooltips       │   │  │
│  │    knowledge │    │  └────────────────────────────┘   │  │
│  │              │    │                                    │  │
│  │ Resources:   │    │ postMessage JSON-RPC 2.0          │  │
│  │  - graph-    │◀───│ (tool_result, host_context)       │  │
│  │    viewer    │    │                                    │  │
│  └──────────────┘    └──────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Spec Compliance (`specification/2026-01-26/apps.mdx`)

| Requirement | Implementation |
|---|---|
| UIResource uri scheme | `ui://infranodus/graph-viewer` |
| MIME type | `text/html;profile=mcp-app` |
| CSP connectDomains | `["infranodus.com"]` |
| Tool-UI linkage | `_meta.ui.resourceUri` on tool results |
| Text fallback | Every tool returns `content[].text` alongside `structuredContent` |
| Communication | JSON-RPC 2.0 over `window.postMessage` |
| Host styling | CSS variable fallbacks (`--color-background-primary`, etc.) |
| Sandbox detection | `window.location.origin === "null"` |
| Single-file bundle | Vite + vite-plugin-singlefile → dist/ui/index.html |

## API Coverage

### InfraNodus REST API (`https://infranodus.com/api/v1/`)

| Endpoint | MCP Tool | UI Attached |
|---|---|---|
| `graphAndStatements` | `generate_knowledge_graph` | ✓ |
| `graphAndStatements` | `get_graph` | ✓ |
| `graphAndStatements` | `add_text` | ✓ |
| `listGraphs` | `list_graphs` | — |
| `graphAndAdvice` | `analyze_graph` | ✓ |
| `aiSearch` | `semantic_search` | — |
| `graphAndStatements` ×2 | `compare_graphs` | — |
| `search` | `search_graphs` | — |
| `importGoogleSearch` | `import_google_search` | ✓ |
| `graphAndStatements` | `export_graph` | — |

### Auth

Bearer token via `INFRANODUS_API_KEY` env var.
Obtain from: https://infranodus.com/api-access

## UI Features (graph-viewer)

1. **Force-directed layout** — ForceAtlas2 via graphology-layout-forceatlas2
2. **Community coloring** — 12 categorical colors (d3.schemePaired-inspired)
3. **Node sizing** — Proportional to degree centrality
4. **Interactive tooltips** — Node name, connection count, betweenness centrality
5. **Cluster sidebar** — Click to highlight community members
6. **Gap visualization** — Structural gaps listed with bridging suggestions
7. **Host theme integration** — CSS variable fallbacks for dark/light modes
8. **Hybrid mode** — Works standalone (URL params) and as MCP App (postMessage)

## UI Modes

Two graph viewer UIs are bundled. Switch at runtime via the `set_ui_mode` tool
or set the `UI_MODE` env var (`sigma` | `canvas`).

| Mode | Engine | Features |
|---|---|---|
| `sigma` (default) | Sigma.js + graphology ForceAtlas2 | Lightweight, fast, sidebar stats grid, cluster list, gap list, hover tooltips |
| `canvas` | Custom canvas force-directed | Topology/Atlas visual directions, glow halos, glassmorphism panels, 10-color oklch palette |

## Build Pipeline

```bash
npm install
npm run build:ui    # Vite → dist/ui/index.html (sigma) + cp mcp-app.html → dist/mcp-app.html (canvas)
npm run build       # UI + TypeScript → dist/
npm run dev         # Development with tsx
```

## File Structure

```
infranodus-mcp-app/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── INFRANODUS-MCP-APP.md    (this file)
├── src/
│   ├── server.ts            (MCP server entry)
│   ├── lib/
│   │   └── api.ts           (InfraNodus REST client)
│   ├── tools/
│   │   ├── graph.ts         (graph generation/retrieval tools)
│   │   ├── analysis.ts      (AI analysis, gaps, comparison)
│   │   └── search.ts        (search, Google import)
│   ├── resources/
│   │   └── graph-ui.ts      (UIResource registration)
│   └── ui/
│       ├── index.html        (App shell)
│       ├── main.ts           (Sigma.js renderer + MCP messaging)
│       └── tsconfig.json     (Browser TS config)
└── dist/
    ├── ui/
    │   └── index.html        (Bundled single-file app)
    └── *.js                   (Compiled server)
```

## Patterns Applied (from patterns.html)

| Pattern | Usage |
|---|---|
| Tool→Resource linkage | All graph-producing tools include `_meta.ui.resourceUri` |
| Text fallback | `content[].text` with formatted graph summary |
| Host context styling | CSS variables with fallback values |
| Hybrid detection | `window.location.origin === "null"` check |
| CSP declaration | `connectDomains: ["infranodus.com"]` for API calls |
| Structured content | `structuredContent.resource` with graph JSON |

## Extending the Existing MCP Server

To integrate into `github.com/infranodus/mcp-server-infranodus`:

1. Install deps: `npm i @modelcontextprotocol/ext-apps sigma graphology graphology-layout-forceatlas2 vite vite-plugin-singlefile`
2. Copy `src/ui/` and `vite.config.ts` to the existing project
3. Add `registerGraphResource()` call in the server's init
4. Update existing tools to return `structuredContent` + `_meta.ui.resourceUri`
5. Build UI: `npx vite build`
6. The existing 26 tools continue working unchanged; UI is purely additive

## Design Token Mapping

InfraNodus web app → MCP App host variables:

| InfraNodus Token | MCP Host Variable | Fallback |
|---|---|---|
| `--mdc-theme-surface` | `--color-background-primary` | `#0a0e1a` |
| `--mdc-theme-on-surface` | `--color-text-primary` | `#e8eaf0` |
| `--mdc-theme-primary` | `--color-accent` | `#6366f1` |
| `--card-bg` | `--color-background-secondary` | `#141824` |
