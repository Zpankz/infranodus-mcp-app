import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { callInfranodusApi, formatGraphSummary } from "../lib/api.js";

const AI_REQUEST_MODES = [
  "summary",
  "question",
  "paraphrase",
  "outline",
  "continue",
  "response",
  "idea",
  "fact",
  "challenge",
  "reprompt",
  "custom",
  "transcend",
] as const;

const OPTIMIZE_MODES = [
  "develop",
  "reinforce",
  "gaps",
  "latent",
  "imagine",
  "optimize",
] as const;

export function registerAnalysisTools(server: McpServer) {
  server.tool(
    "analyze_graph",
    "Get AI-powered analysis and advice for a knowledge graph. Includes content gaps, research questions, and structural insights.",
    {
      context: z.string().describe("Graph context/name to analyze"),
      requestMode: z
        .enum(AI_REQUEST_MODES)
        .optional()
        .describe("Type of AI analysis to perform"),
      optimizeMode: z
        .enum(OPTIMIZE_MODES)
        .optional()
        .describe("Graph optimization strategy"),
      customPrompt: z
        .string()
        .optional()
        .describe("Custom prompt for AI (used with requestMode='custom')"),
    },
    async ({ context, requestMode, optimizeMode, customPrompt }) => {
      const data = await callInfranodusApi("graphAndAdvice", {
        context,
        requestMode: requestMode || "summary",
        optimizeMode: optimizeMode || "develop",
        customPrompt,
      });

      const summary = formatGraphSummary(data);
      const advice = data.aiAdvice || data.advice || "";

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
            text: `${summary}\n\n## AI Analysis\n${advice}`,
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
    "generate_content_gaps",
    "Identify structural gaps between topic clusters in a knowledge graph. Gaps represent unexplored connections between concepts.",
    {
      context: z.string().describe("Graph context/name"),
    },
    async ({ context }) => {
      const data = await callInfranodusApi("graphAiAdvice", {
        context,
        optimizeMode: "gaps",
        requestMode: "idea",
      });

      const gaps = data.gaps || [];
      const gapText = gaps.length
        ? gaps
            .map(
              (g: { cluster1: string; cluster2: string; suggestion: string }) =>
                `- **${g.cluster1}** ↔ **${g.cluster2}**: ${g.suggestion}`
            )
            .join("\n")
        : "No structural gaps detected.";

      return {
        content: [
          {
            type: "text" as const,
            text: `## Content Gaps\n${gapText}`,
          },
        ],
      };
    }
  );

  server.tool(
    "compare_graphs",
    "Compare two knowledge graphs to find overlaps and unique concepts.",
    {
      context1: z.string().describe("First graph context/name"),
      context2: z.string().describe("Second graph context/name"),
    },
    async ({ context1, context2 }) => {
      const data = await callInfranodusApi("compareGraphs", {
        context1,
        context2,
      });

      const overlap = data.overlap || [];
      const unique1 = data.unique1 || [];
      const unique2 = data.unique2 || [];

      return {
        content: [
          {
            type: "text" as const,
            text: [
              `## Graph Comparison: ${context1} vs ${context2}`,
              `\n### Shared concepts (${overlap.length}):`,
              overlap.slice(0, 20).join(", "),
              `\n### Unique to ${context1} (${unique1.length}):`,
              unique1.slice(0, 20).join(", "),
              `\n### Unique to ${context2} (${unique2.length}):`,
              unique2.slice(0, 20).join(", "),
            ].join("\n"),
          },
        ],
      };
    }
  );
}
