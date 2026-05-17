# InfraNodus MCP App

Bring InfraNodus's network-thinking experience — knowledge-graph
visualization, structural-gap discovery, and natural-language graph
queries — into any [MCP](https://modelcontextprotocol.io/) host.

This repo contains:

| Path | What |
|---|---|
| **`docs/design.md`** | The design specification (v0.1). Tokens, components, MCP contract. |
| **`docs/mockups/`** | Interactive design-canvas preview of the two visual directions × five surfaces. Open `docs/mockups/index.html` in a browser. |
| **`app/`** | The MCP app bundle. Loaded by the host as `application/vnd.mcp.app+html`. Renders inside a sandboxed iframe; talks to the host via `window.mcp`. |
| **`server/`** | The MCP server stub. Declares the tools (`analyzeText`, `composeQuery`, `findBridges`, `findGaps`, `summarize`, `listGraphs`) and wires their results to render in the app. |

## Quick start

```bash
# 1. Preview the design
open docs/mockups/index.html

# 2. Read the spec
open docs/design.md

# 3. Run the server (stub)
cd server && npm install && npm start

# 4. Connect from your MCP host
#    e.g. Claude Desktop config → mcpServers → "infranodus":
#    { "command": "node", "args": ["./server/src/index.js"] }
```

## Two design directions

- **Topology** — terminal/dev-tool: dense panels, mono headers, single accent.
  Best inline alongside code (Claude Desktop, Obsidian).
- **Atlas** — graph-first: full-bleed canvas, soft node glow, multi-cluster
  palette. Best in fullscreen / presentation.

Both ship in the same bundle and switch via the host's theme + the app's
Tweaks panel.

## Surfaces

| # | Surface | URI |
|---|---|---|
| 01 | Graph canvas | `graph://<id>` |
| 02 | Query compiler | `graph://<id>/query` |
| 03 | Insights & gaps | `graph://<id>/insights` |
| 04 | Resource browser | `graphs://` |
| 05 | Onboarding | `app://onboard` |

## Sibling projects

- [`noduslabs/infranodus-obsidian-plugin`](https://github.com/noduslabs/infranodus-obsidian-plugin) — Obsidian plugin
- [`infranodus/mcp-server-infranodus`](https://github.com/infranodus/mcp-server-infranodus) — upstream MCP server (this repo composes against it)
- [`infranodus.com`](https://infranodus.com) — the web app

## Status

`v0.1` · design proposal. Implementation tracks the
[`apps/2026-01-26`](https://modelcontextprotocol.io/specification/2026-01-26/apps)
revision of the MCP Apps spec.

## License

MIT — see [LICENSE](./LICENSE).
