import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { VIEW_URI, getUiMode } from "../shared.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "../..");

function loadUiHtml(): string {
  const mode = getUiMode();

  // 3D: Three.js force-directed 3D graph with bloom and orbit controls
  if (mode === "3d") {
    try {
      return readFileSync(join(root, "dist/ui-3d/index.html"), "utf-8");
    } catch {
      // fall through to sigma
    }
  }

  // Sigma (v2): Sigma.js + graphology force-directed graph
  if (mode === "sigma") {
    try {
      return readFileSync(join(root, "dist/ui/index.html"), "utf-8");
    } catch {
      // fall through to canvas
    }
  }

  // Canvas (v1): Custom canvas-based force-directed graph with Topology/Atlas modes
  if (mode === "canvas") {
    try {
      return readFileSync(join(root, "dist/mcp-app.html"), "utf-8");
    } catch {
      // fall through
    }
  }

  // Try all in order
  for (const path of ["dist/ui-3d/index.html", "dist/ui/index.html", "dist/mcp-app.html"]) {
    try { return readFileSync(join(root, path), "utf-8"); } catch {}
  }

  return getFallbackHtml();
}

export function registerGraphResource(server: McpServer) {
  server.resource(
    "graph-viewer",
    VIEW_URI,
    {
      description: "Interactive knowledge graph visualization. Modes: sigma (2D), 3d (Three.js), canvas. Controlled by set_ui_mode tool.",
      mimeType: "text/html;profile=mcp-app",
    },
    async () => ({
      contents: [{
        uri: VIEW_URI,
        mimeType: "text/html;profile=mcp-app" as const,
        text: loadUiHtml(),
      }],
    })
  );
}

function getFallbackHtml(): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>InfraNodus Graph</title>
<style>body{margin:0;font-family:system-ui;background:#0a0e1a;color:#e8eaf0;display:flex;align-items:center;justify-content:center;height:100vh;font-size:14px;opacity:0.6}</style>
</head><body>Awaiting graph data\u2026</body></html>`;
}
