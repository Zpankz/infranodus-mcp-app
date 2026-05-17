import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerPrompts(server: McpServer): void {
  server.prompt(
    "find-bridges",
    "Find bridging concepts between topic clusters in a knowledge graph",
    { context: z.string().describe("Name of the knowledge graph to analyze") },
    async ({ context }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Analyze the knowledge graph "${context}" to find bridging concepts between topic clusters. Use the analyze_graph tool with optimize=gaps to identify key nodes that connect different communities. Focus on high betweenness centrality nodes that act as conceptual bridges.`,
        },
      }],
    })
  );

  server.prompt(
    "find-gaps",
    "Identify structural gaps and unexplored connections in a knowledge graph",
    { context: z.string().describe("Name of the knowledge graph to analyze") },
    async ({ context }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Analyze the knowledge graph "${context}" to identify structural gaps. Use the analyze_graph tool with optimize=gaps and request_mode=question to discover missing links between clusters and generate insightful questions that could bridge these gaps.`,
        },
      }],
    })
  );

  server.prompt(
    "summarize-graph",
    "Generate a comprehensive summary of a knowledge graph",
    { context: z.string().describe("Name of the knowledge graph to summarize") },
    async ({ context }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Provide a comprehensive summary of the knowledge graph "${context}". Use the analyze_graph tool with request_mode=summary to extract main topics, topical clusters, structural patterns, and overall graph characteristics.`,
        },
      }],
    })
  );

  server.prompt(
    "explore-topic",
    "Deep-dive into a specific topic within a knowledge graph",
    {
      context: z.string().describe("Name of the knowledge graph to explore"),
      topic: z.string().describe("Specific topic or concept to focus on"),
    },
    async ({ context, topic }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Deep-dive into "${topic}" within the knowledge graph "${context}". Use the analyze_graph tool with pinned_nodes="${topic}" to explore its connections, related concepts, and role in the overall graph structure.`,
        },
      }],
    })
  );
}
