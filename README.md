# InfraNodus MCP App

Knowledge graph visualization and analysis for [Claude Desktop](https://claude.ai/desktop) and other MCP hosts. Connects to the [InfraNodus](https://infranodus.com) API to turn text into interactive network graphs, surface structural gaps, and generate AI-grounded insights — rendered inline as an MCP App.

## Features

- **12 tools** — graph generation, AI analysis, semantic search, comparison, export
- **3 visualization modes** — Sigma.js 2D, Three.js 3D (with 2D/3D toggle), custom canvas
- **MCP Apps spec compliant** — host-aware theming, `window.mcp` channel, manifest
- **Real API integration** — connects to InfraNodus REST API for graph analysis
- **Dual transport** — HTTP (Express) for web + stdio for Claude Desktop
- **Interactive sidebar** — clusters, structural gaps, stats, click-to-highlight

## Quick Start

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "infranodus": {
      "command": "node",
      "args": ["--import", "tsx", "/path/to/infranodus-mcp-app/main.ts", "--stdio"],
      "env": {
        "INFRANODUS_API_KEY": "your_key_here"
      }
    }
  }
}
```

### HTTP Server

```bash
git clone https://github.com/Zpankz/infranodus-mcp-app.git
cd infranodus-mcp-app
npm install
npm run build

export INFRANODUS_API_KEY="your_key_here"
npm start  # → http://localhost:8000/mcp
```

Get your API key at [infranodus.com/api-access](https://infranodus.com/api-access).

## Tools

| Tool | Description |
|---|---|
| `generate_knowledge_graph` | Generate a graph from text — returns nodes, edges, clusters, gaps, visualization |
| `get_graph` | Retrieve an existing graph by context name |
| `list_graphs` | List all graphs in the InfraNodus account |
| `add_text` | Add text to an existing graph |
| `analyze_graph` | AI analysis with request modes (summary, question, idea, etc.) and optimization strategies |
| `semantic_search` | AI semantic search within a graph's content |
| `compare_graphs` | Compare two graphs — shared concepts, unique nodes, overlap percentage |
| `search_graphs` | Keyword search across all saved graphs |
| `import_google_search` | Import Google search results into a graph |
| `export_graph` | Export graph as DOT, JSON, or CSV |
| `set_ui_mode` | Switch visualization: `sigma` (2D), `3d` (Three.js), or `canvas` |
| `get_ui_mode` | Get current visualization mode |

## Prompts

| Prompt | Description |
|---|---|
| `find-bridges` | Find bridging concepts between topic clusters |
| `find-gaps` | Identify structural gaps and unexplored connections |
| `summarize-graph` | Generate a comprehensive graph summary |
| `explore-topic` | Deep-dive into a specific topic within a graph |

## UI Modes

Switch modes with the `set_ui_mode` tool:

| Mode | Engine | Bundle | Features |
|---|---|---|---|
| **sigma** (default) | Sigma.js + ForceAtlas2 | 47 KB | Fast 2D layout, sidebar stats, cluster/gap lists |
| **3d** | 3d-force-graph + Three.js | 366 KB | 3D orbit controls, glow bloom, 2D/3D toggle, click-to-focus |
| **canvas** | Custom canvas engine | 54 KB | Topology/Atlas directions, glassmorphism panels |

## Architecture

```
main.ts                      Entry point (HTTP + stdio)
src/
├── server.ts                MCP server factory
├── shared.ts                State: graphStore, UiMode
├── lib/api.ts               InfraNodus REST client
├── tools/
│   ├── graph.ts             generate_knowledge_graph, get_graph, list_graphs, add_text
│   ├── analysis.ts          analyze_graph, semantic_search, compare_graphs
│   ├── search.ts            search_graphs, import_google_search, export_graph
│   └── settings.ts          set_ui_mode, get_ui_mode
├── prompts.ts               MCP prompts (find-bridges, find-gaps, etc.)
├── resources/graph-ui.ts    UIResource handler (serves active UI mode)
└── ui/
    ├── host.ts              MCP host channel (apps/2026-01-26 spec)
    ├── index.html + main.ts           Sigma.js viewer
    ├── index-3d.html + main-3d.ts     3D force-graph viewer
    └── tsconfig.json                  Browser TS config
```

## Development

```bash
npm run dev          # Dev server with hot reload (tsx --watch)
npm run build        # Build all UIs + type check
npm run build:ui     # Build sigma UI only
npm run build:3d     # Build 3D UI only
npm run build:check  # TypeScript type check
```

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `INFRANODUS_API_KEY` | Yes | — | API key from infranodus.com/api-access |
| `PORT` | No | `8000` | HTTP server port |
| `UI_MODE` | No | `sigma` | Default UI mode (`sigma`, `3d`, `canvas`) |
| `INFRANODUS_API_URL` | No | `https://infranodus.com` | API base URL |

## Related Projects

- [InfraNodus](https://infranodus.com) — Knowledge graph web app
- [mcp-server-infranodus](https://github.com/infranodus/mcp-server-infranodus) — Upstream MCP server
- [MCP](https://modelcontextprotocol.io) — Model Context Protocol

## License

MIT
