import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { callApi, parseGraphData, formatGraphSummary } from "../lib/api.js";
import { VIEW_URI } from "../shared.js";

export function registerSearchTools(server: McpServer) {
  server.tool(
    "search_graphs",
    "Search across all saved InfraNodus knowledge graphs by keyword or phrase.",
    { query: z.string().describe("Search query") },
    async ({ query }) => {
      const data = await callApi("search", { query });

      // Handle different response shapes
      const results: any[] = data?.results || (Array.isArray(data) ? data : []);

      if (!results.length) {
        return { content: [{ type: "text" as const, text: `No results found for "${query}".` }] };
      }

      const formatted = results.map((r: any, i: number) => {
        const name = r.name || r.context || r.graphName || "Unknown";
        const text = r.text || r.matchedText || r.content || r.snippet || "";
        const score = r.score ?? r.relevance ?? r.weight;
        const parts = [`${i + 1}. **${name}**`];
        if (text) parts.push(`   ${text}`);
        if (score != null) parts.push(`   Relevance: ${score}`);
        return parts.join("\n");
      }).join("\n\n");

      return {
        content: [{ type: "text" as const, text: `## Search Results for "${query}"\n\n${formatted}` }],
      };
    }
  );

  server.tool(
    "import_google_search",
    "Import Google search results into a knowledge graph for analysis.",
    {
      query: z.string().describe("Google search query"),
      context: z.string().optional().describe("Target graph name (defaults to sanitized query)"),
    },
    async ({ query, context }) => {
      const targetContext = context || query.replace(/\s+/g, "-").toLowerCase();
      const data = await callApi("importGoogleSearch", { query, context: targetContext });

      // Try to parse any graph data returned
      let resultContent: any;
      try {
        const parsed = parseGraphData(data, targetContext);
        resultContent = {
          structuredContent: {
            type: "resource" as const,
            resource: { uri: VIEW_URI, mimeType: "text/html;profile=mcp-app" as const, text: JSON.stringify(parsed) },
          },
          content: [{ type: "text" as const, text: `Imported Google search results for "${query}" into graph "${targetContext}".\n\n${formatGraphSummary(parsed)}` }],
          _meta: { ui: { resourceUri: VIEW_URI } },
        };
      } catch {
        resultContent = {
          content: [{ type: "text" as const, text: `Imported Google search results for "${query}" into graph "${targetContext}".` }],
        };
      }
      return resultContent;
    }
  );

  server.tool(
    "export_graph",
    "Export a knowledge graph in DOT, JSON, or CSV format.",
    {
      context: z.string().describe("Graph context name to export"),
      format: z.enum(["dot", "json", "csv"]).optional().describe("Export format (default: json)"),
    },
    async ({ context, format }) => {
      const fmt = format || "json";
      const data = await callApi("graphAndStatements", { context }, "addStats=true&dotGraph=true");

      const g = data?.entriesAndGraphOfContext?.graph?.graphologyGraph;
      if (!g) throw new Error(`Graph "${context}" not found or has no data.`);

      let exportedData: string;

      if (fmt === "dot") {
        exportedData = g.attributes?.dotGraph || "// No DOT graph data available";
      } else if (fmt === "csv") {
        const nodes = g.nodes || [];
        const edges = g.edges || [];
        let csv = "# Nodes\nid,community,degree,betweenness\n";
        for (const n of nodes) {
          csv += `"${n.key}",${n.attributes?.community ?? 0},${n.attributes?.degree ?? 0},${n.attributes?.betweenness ?? n.attributes?.bc ?? 0}\n`;
        }
        csv += "\n# Edges\nsource,target,weight\n";
        for (const e of edges) {
          csv += `"${e.source}","${e.target}",${e.attributes?.weight ?? 1}\n`;
        }
        exportedData = csv;
      } else {
        exportedData = JSON.stringify(g, null, 2);
      }

      return { content: [{ type: "text" as const, text: exportedData }] };
    }
  );
}
