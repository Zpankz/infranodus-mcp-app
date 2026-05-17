import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function registerGraphResource(server: McpServer) {
  server.resource(
    "graph-viewer",
    "ui://infranodus/graph-viewer",
    {
      description:
        "Interactive knowledge graph visualization with force-directed layout, community coloring, and gap highlighting",
      mimeType: "text/html;profile=mcp-app",
      _meta: {
        ui: {
          csp: {
            connectDomains: ["infranodus.com"],
          },
          permissions: [],
          prefersBorder: false,
        },
      },
    },
    async () => {
      let html: string;
      try {
        html = readFileSync(
          join(__dirname, "../../dist/ui/index.html"),
          "utf-8"
        );
      } catch {
        html = getFallbackHtml();
      }

      return {
        contents: [
          {
            uri: "ui://infranodus/graph-viewer",
            mimeType: "text/html;profile=mcp-app",
            text: html,
          },
        ],
      };
    }
  );
}

function getFallbackHtml(): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>InfraNodus Graph</title>
<style>
body { margin: 0; font-family: var(--font-sans, system-ui); background: var(--color-background-primary, #0a0e1a); color: var(--color-text-primary, #e8eaf0); }
#graph { width: 100vw; height: 100vh; }
.loading { display: flex; align-items: center; justify-content: center; height: 100vh; font-size: 14px; opacity: 0.6; }
</style>
</head>
<body>
<div id="graph"><div class="loading">Awaiting graph data...</div></div>
<script>
window.addEventListener("message", (e) => {
  if (e.data?.type === "tool_result") {
    try {
      const graphData = JSON.parse(e.data.content);
      document.getElementById("graph").innerHTML = "<pre>" + JSON.stringify(graphData, null, 2).slice(0, 5000) + "</pre>";
    } catch {}
  }
});
</script>
</body>
</html>`;
}
