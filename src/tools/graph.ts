import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { callApi, parseGraphData, formatGraphSummary } from "../lib/api.js";
import { storeGraph, VIEW_URI } from "../shared.js";

const CONTEXT_SETTINGS: Record<string, any> = {
  "Concepts only": { partOfSpeechToProcess: "HASHTAGS_AND_WORDS", doubleSquarebracketsProcessing: "EXCLUDE" },
  "[[Wiki Links]] and Concepts": { partOfSpeechToProcess: "HASHTAGS_AND_WORDS", doubleSquarebracketsProcessing: "PROCESS_AS_HASHTAGS" },
  "[[Wiki Links]] Only": { partOfSpeechToProcess: "HASHTAGS_ONLY", doubleSquarebracketsProcessing: "PROCESS_AS_HASHTAGS" },
  "[[Wiki Links]] Prioritized": { partOfSpeechToProcess: "WORDS_IF_NO_HASHTAGS", doubleSquarebracketsProcessing: "PROCESS_AS_HASHTAGS" },
};

function graphResult(parsed: any, summary: string) {
  return {
    structuredContent: {
      type: "resource" as const,
      resource: { uri: VIEW_URI, mimeType: "text/html;profile=mcp-app" as const, text: JSON.stringify(parsed) },
    },
    content: [{ type: "text" as const, text: summary }],
    _meta: { ui: { resourceUri: VIEW_URI } },
  };
}

export function registerGraphTools(server: McpServer) {
  server.tool(
    "generate_knowledge_graph",
    "Generate a knowledge graph from text using InfraNodus. Returns nodes, edges, clusters, gaps, and interactive visualization.",
    {
      text: z.string().describe("Text to analyze and generate graph from"),
      name: z.string().optional().describe("Context name for the graph"),
      context_mode: z.enum(["Concepts only", "[[Wiki Links]] and Concepts", "[[Wiki Links]] Only", "[[Wiki Links]] Prioritized"]).optional(),
      ai_topics: z.boolean().optional().describe("Enable AI topic extraction"),
    },
    async ({ text, name, context_mode, ai_topics }) => {
      let qs = "doNotSave=true&addStats=true&dotGraph=true&optimize=develop&extendedGraphSummary=true";
      if (ai_topics) qs += "&aiTopics=true";

      const body: any = { name: name || "MCP Analysis", text };
      body.contextSettings = CONTEXT_SETTINGS[context_mode || "Concepts only"];
      if (ai_topics) body.aiTopics = true;

      const data = await callApi("graphAndStatements", body, qs);
      const parsed = parseGraphData(data, name);
      storeGraph(name || "MCP Analysis", text, parsed);
      return graphResult(parsed, formatGraphSummary(parsed));
    }
  );

  server.tool(
    "get_graph",
    "Retrieve an existing knowledge graph by context name from InfraNodus.",
    { context: z.string().describe("Graph context name to retrieve") },
    async ({ context }) => {
      const data = await callApi("graphAndStatements", { context }, "addStats=true&dotGraph=true&extendedGraphSummary=true");
      const parsed = parseGraphData(data, context);
      return graphResult(parsed, formatGraphSummary(parsed));
    }
  );

  server.tool(
    "list_graphs",
    "List all available knowledge graphs in the user's InfraNodus account.",
    {},
    async () => {
      const data = await callApi("listGraphs", {});
      const graphs = data.graphs || [];
      const text = graphs.length === 0
        ? "No graphs found."
        : `Found ${graphs.length} graphs:\n\n` +
          graphs.map((g: any) => `• ${g.name} (${g.nodes || 0} nodes, ${g.edges || 0} edges)`).join("\n");
      return { content: [{ type: "text" as const, text }] };
    }
  );

  server.tool(
    "add_text",
    "Add text to an existing InfraNodus graph context.",
    {
      text: z.string().describe("Text to add"),
      context: z.string().describe("Target graph context name"),
    },
    async ({ text, context }) => {
      const data = await callApi("graphAndStatements", { name: context, text }, "addStats=true&dotGraph=true&optimize=develop");
      const parsed = parseGraphData(data, context);
      return graphResult(parsed, formatGraphSummary(parsed));
    }
  );
}
