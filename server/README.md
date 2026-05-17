# InfraNodus MCP Server (stub)

This is a **stub** MCP server that declares the tools and resources the
InfraNodus MCP app surfaces. It is intentionally minimal — the real graph
backend lives upstream in
[`infranodus/mcp-server-infranodus`](https://github.com/infranodus/mcp-server-infranodus)
and on the [InfraNodus](https://infranodus.com) web app's API.

The stub's job is to:

1. **Declare the tool schemas** (input + output) so any MCP host can introspect.
2. **Wire results to surfaces.** Every tool result returns an
   `application/vnd.mcp.app+html` content block plus a `meta.surface`
   hint so the app routes to the right screen
   (see `app/src/app.jsx`).
3. **Forward** the actual work to the upstream server or InfraNodus API.

## Run

```bash
npm install
npm start
```

Configure your host (Claude Desktop, Goose, etc.) to add this server:

```json
{
  "mcpServers": {
    "infranodus": {
      "command": "node",
      "args": ["./server/src/index.js"]
    }
  }
}
```

## Tools

| Tool | Surface | Forwards to |
|---|---|---|
| `analyzeText` | `canvas` | `upstream.analyzeText` |
| `openGraph` | `canvas` | `upstream.getGraph` |
| `composeQuery` | `query` | local (haiku via `claude.complete`) |
| `runQueryPlan` | `canvas` / `insights` | parallel `upstream.*` calls |
| `findBridges` | inline | `upstream.findBridges` |
| `expandConcept` | inline | `upstream.expandConcept` |
| `summarize` | `insights` | `upstream.summarize` |
| `findGaps` | `insights` | `upstream.findGaps` |
| `listGraphs` | `resources` | `upstream.listGraphs` |
| `diff` | `insights` | `upstream.diff` |

## Resources

- `graph://<id>` — the materialized graph (JSON)
- `graph://<id>/summary` — short text summary
- `graphs://` — listing of saved graphs

## Notes

Per the [`apps/2026-01-26`](https://modelcontextprotocol.io/specification/2026-01-26/apps)
spec, every tool result includes an HTML payload pointing at the app entry
(`app/index.html`) plus a `meta` block with `surface` and `graphId` so the
app knows where to route.
