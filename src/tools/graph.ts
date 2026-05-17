import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { callInfranodusApi, formatGraphSummary } from "../lib/api.js";

export function registerGraphTools(server: McpServer) {
  server.tool(
    "generate_knowledge_graph",
    "Generate a knowledge graph from text. Returns graph data with nodes (concepts), edges (connections), and statistics. Includes interactive visualization.",
    {
      text: z.string().describe("Text to analyze and generate graph from"),
      context: z.string().optional().describe("Graph context/name for persistence"),
    },
    async ({ text, context }) => {
      const data = await callInfranodusApi("dotGraphFromText", {
        text,
        context: context || "mcp-graph",
      });

      const summary = formatGraphSummary(data);

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
            text: summary,
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

  server.tool(
    "get_graph",
    "Retrieve an existing knowledge graph by context name. Returns full graph with nodes, edges, communities, and gap analysis.",
    {
      context: z.string().describe("Graph context/name to retrieve"),
    },
    async ({ context }) => {
      const data = await callInfranodusApi("graphAndStatements", {
        context,
      });

      const summary = formatGraphSummary(data);

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
            text: summary,
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

  server.tool(
    "list_graphs",
    "List all available knowledge graphs in the user's InfraNodus account.",
    {},
    async () => {
      const data = await callInfranodusApi("listGraphs", {});

      const graphs = data.graphs || [];
      const listing = graphs
        .map(
          (g: { name: string; nodes: number; edges: number }) =>
            `- ${g.name} (${g.nodes} nodes, ${g.edges} edges)`
        )
        .join("\n");

      return {
        content: [
          {
            type: "text" as const,
            text: graphs.length
              ? `Available graphs:\n${listing}`
              : "No graphs found.",
          },
        ],
      };
    }
  );
}
