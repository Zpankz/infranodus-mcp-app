import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { callInfranodusApi } from "../lib/api.js";

export function registerSearchTools(server: McpServer) {
  server.tool(
    "search_knowledge",
    "Search across all knowledge graphs for relevant concepts and statements.",
    {
      query: z.string().describe("Search query"),
      context: z
        .string()
        .optional()
        .describe("Limit search to specific graph context"),
    },
    async ({ query, context }) => {
      const data = await callInfranodusApi("search", {
        query,
        context,
      });

      const results = data.results || [];
      const formatted = results
        .slice(0, 15)
        .map(
          (r: { text: string; context: string; score: number }, i: number) =>
            `${i + 1}. [${r.context}] ${r.text} (relevance: ${(r.score * 100).toFixed(0)}%)`
        )
        .join("\n");

      return {
        content: [
          {
            type: "text" as const,
            text: results.length
              ? `## Search Results for "${query}"\n${formatted}`
              : `No results found for "${query}".`,
          },
        ],
      };
    }
  );

  server.tool(
    "import_google_search",
    "Import Google search results into a knowledge graph for analysis.",
    {
      query: z.string().describe("Google search query"),
      context: z
        .string()
        .optional()
        .describe("Target graph context (defaults to query-based name)"),
    },
    async ({ query, context }) => {
      const data = await callInfranodusApi("importGoogleSearch", {
        query,
        context: context || query.replace(/\s+/g, "-").toLowerCase(),
      });

      const imported = data.imported || 0;

      return {
        structuredContent: {
          type: "resource" as const,
          resource: {
            uri: "ui://infranodus/graph-viewer",
            mimeType: "text/html;profile=mcp-app",
            text: JSON.stringify(data),
          },
        },
        content: [
          {
            type: "text" as const,
            text: `Imported ${imported} search results for "${query}" into graph.`,
          },
        ],
        _meta: {
          ui: {
            resourceUri: "ui://infranodus/graph-viewer",
          },
        },
      };
    }
  );
}
