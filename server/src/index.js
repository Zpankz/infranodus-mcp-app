// ============================================================
// InfraNodus MCP Server — stub entry
//
// Wires tools and resources to the InfraNodus MCP app. Each tool result
// returns an `application/vnd.mcp.app+html` content block with a meta
// hint (`surface`, `graphId`) so the app routes to the right screen.
//
// The graph backend itself lives upstream (mcp-server-infranodus or the
// InfraNodus REST API); the `upstream` shim below is where you wire that
// up. The stub returns deterministic placeholder data so the app can be
// previewed end-to-end without credentials.
// ============================================================

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { analyzeText }   from "./tools/analyzeText.js";
import { composeQuery }  from "./tools/composeQuery.js";
import { findBridges }   from "./tools/findBridges.js";
import { findGaps }      from "./tools/findGaps.js";
import { summarize }     from "./tools/summarize.js";
import { listGraphs }    from "./tools/listGraphs.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_HTML_PATH = resolve(__dirname, "../../app/index.html");

// Load the app bundle once at boot. In production this is fingerprinted
// and served by the host; the stub inlines it for the simplest possible
// MCP-apps-compliant payload.
let APP_HTML = "";
try { APP_HTML = await readFile(APP_HTML_PATH, "utf8"); }
catch { APP_HTML = "<!doctype html><body>InfraNodus app bundle missing.</body>"; }

// Helper — wrap any tool result in the apps-spec content shape.
export function appResult({ surface, graphId, structuredContent }) {
  return {
    content: [
      {
        type: "resource",
        resource: {
          uri: graphId ? `graph://${graphId}` : `app://${surface || "onboard"}`,
          mimeType: "application/vnd.mcp.app+html",
          text: APP_HTML,
        },
      },
    ],
    structuredContent,
    meta: { surface, graphId },
  };
}

// ── Server boot ─────────────────────────────────────────────
const server = new Server(
  { name: "infranodus", version: "0.1.0" },
  { capabilities: { tools: {}, resources: {}, prompts: {} } },
);

// Tool registry — schema + handler per tool.
const TOOLS = {
  analyzeText, composeQuery, findBridges, findGaps, summarize, listGraphs,
};

server.setRequestHandler("tools/list", async () => ({
  tools: Object.values(TOOLS).map(({ name, description, inputSchema }) =>
    ({ name, description, inputSchema })),
}));

server.setRequestHandler("tools/call", async (req) => {
  const tool = TOOLS[req.params.name];
  if (!tool) throw new Error(`Unknown tool: ${req.params.name}`);
  return tool.run(req.params.arguments ?? {}, { appResult });
});

// Resources — the materialized graphs the app can deep-link into.
server.setRequestHandler("resources/list", async () => ({
  resources: [
    { uri: "graphs://", name: "All graphs", mimeType: "application/vnd.infranodus.index+json" },
    { uri: "graph://demo", name: "Demo graph", mimeType: "application/vnd.infranodus.graph+json" },
  ],
}));

server.setRequestHandler("resources/read", async (req) => {
  if (req.params.uri === "graphs://") {
    return { contents: [{ uri: req.params.uri, mimeType: "application/json", text: JSON.stringify({ graphs: ["demo"] }) }] };
  }
  // graph://<id> — defer to the same code path the canvas uses
  return analyzeText.run({ text: "demo" }, { appResult });
});

// Prompts — discoverable recipes (named NL queries).
server.setRequestHandler("prompts/list", async () => ({
  prompts: [
    { name: "find-bridges", description: "What concepts bridge two clusters?" },
    { name: "find-gaps",    description: "Where are the structural gaps?" },
    { name: "summarize",    description: "Summarize this graph." },
    { name: "diff-week",    description: "How did the graph change over the last week?" },
  ],
}));

await server.connect(new StdioServerTransport());
console.error("[infranodus] mcp server ready · stdio");
