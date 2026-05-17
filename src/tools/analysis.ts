import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { callApi, parseGraphData, formatGraphSummary } from "../lib/api.js";
import { getLatestGraph, VIEW_URI } from "../shared.js";

const REQUEST_MODES = [
  "question", "summary", "response", "idea", "challenge",
  "fact", "continue", "transcend", "paraphrase", "outline",
] as const;

const OPTIMIZE_MODES = [
  "gaps", "develop", "reinforce", "latent", "imagine", "optimize",
] as const;

export function registerAnalysisTools(server: McpServer) {
  server.tool(
    "analyze_graph",
    "Get AI-powered analysis and advice for a knowledge graph. Uses InfraNodus grounded AI to generate insights based on actual graph structure.",
    {
      context: z.string().describe("Graph context name to analyze"),
      request_mode: z.enum(REQUEST_MODES).optional().describe("Type of AI analysis (default: summary)"),
      optimize: z.enum(OPTIMIZE_MODES).optional().describe("Optimization strategy (default: develop)"),
      pinned_nodes: z.string().optional().describe("Comma-separated node names to focus on"),
      text: z.string().optional().describe("Additional text context"),
    },
    async ({ context, request_mode, optimize, pinned_nodes, text }) => {
      const body: Record<string, unknown> = {
        context,
        request_mode: request_mode || "summary",
        optimize: optimize || "develop",
      };
      if (pinned_nodes) body.pinned_nodes = pinned_nodes;
      if (text) body.text = text;

      const data = await callApi("graphAndAdvice", body, "addStats=true&dotGraph=true&extendedGraphSummary=true");

      const parsed = parseGraphData(data, context);
      const summary = formatGraphSummary(parsed);
      const aiAdvice = data.advice || data.aiAdvice || "No AI advice available.";

      return {
        structuredContent: {
          type: "resource" as const,
          resource: { uri: VIEW_URI, mimeType: "text/html;profile=mcp-app" as const, text: JSON.stringify(parsed) },
        },
        content: [{ type: "text" as const, text: `${summary}\n\n## AI Analysis\n\n${aiAdvice}` }],
        _meta: { ui: { resourceUri: VIEW_URI } },
      };
    }
  );

  server.tool(
    "semantic_search",
    "Search within a knowledge graph using AI semantic search. Finds relevant concepts and statements.",
    {
      query: z.string().describe("Search query"),
      context: z.string().optional().describe("Graph context to search in"),
      text: z.string().optional().describe("Text to search within (if no context)"),
    },
    async ({ query, context, text }) => {
      const body: Record<string, unknown> = { query };

      if (context) {
        body.context = context;
      } else if (text) {
        body.text = text;
      } else {
        // Fall back to latest stored graph text
        const latest = getLatestGraph();
        if (latest?.text) body.text = latest.text;
      }

      // aiSearch returns an array directly: [{similarity, matchedContent}]
      const results = await callApi("aiSearch", body);

      if (!Array.isArray(results) || results.length === 0) {
        return { content: [{ type: "text" as const, text: "No semantic search results found." }] };
      }

      const formatted = results
        .map((r: any, i: number) => `${i + 1}. [${(r.similarity * 100).toFixed(1)}%] ${r.matchedContent}`)
        .join("\n\n");

      return {
        content: [{ type: "text" as const, text: `## Semantic Search: \"${query}\"\n\n${formatted}` }],
      };
    }
  );

  server.tool(
    "compare_graphs",
    "Compare two knowledge graphs to find shared and unique concepts. Fetches both graphs and compares node sets.",
    {
      context1: z.string().describe("First graph context name"),
      context2: z.string().describe("Second graph context name"),
    },
    async ({ context1, context2 }) => {
      const [data1, data2] = await Promise.all([
        callApi("graphAndStatements", { context: context1 }, "addStats=true"),
        callApi("graphAndStatements", { context: context2 }, "addStats=true"),
      ]);

      const parsed1 = parseGraphData(data1, context1);
      const parsed2 = parseGraphData(data2, context2);

      const set1 = new Set(parsed1.graphNodes.map((n) => n.id));
      const set2 = new Set(parsed2.graphNodes.map((n) => n.id));

      const shared = [...set1].filter((n) => set2.has(n));
      const unique1 = [...set1].filter((n) => !set2.has(n));
      const unique2 = [...set2].filter((n) => !set1.has(n));

      const overlap = Math.max(set1.size, set2.size) > 0
        ? ((shared.length / Math.max(set1.size, set2.size)) * 100).toFixed(1)
        : "0";

      const text = [
        `## Graph Comparison: "${context1}" vs "${context2}"`,
        "",
        `### Shared Concepts (${shared.length})`,
        shared.length ? shared.join(", ") : "None",
        "",
        `### Unique to "${context1}" (${unique1.length})`,
        unique1.length ? unique1.slice(0, 30).join(", ") + (unique1.length > 30 ? "..." : "") : "None",
        "",
        `### Unique to "${context2}" (${unique2.length})`,
        unique2.length ? unique2.slice(0, 30).join(", ") + (unique2.length > 30 ? "..." : "") : "None",
        "",
        `### Stats`,
        `- ${context1}: ${set1.size} nodes, ${parsed1.edgeCount} edges`,
        `- ${context2}: ${set2.size} nodes, ${parsed2.edgeCount} edges`,
        `- Overlap: ${overlap}%`,
      ].join("\n");

      return { content: [{ type: "text" as const, text }] };
    }
  );
}
