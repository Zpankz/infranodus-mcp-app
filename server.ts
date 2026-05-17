import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";

const VIEW_URI = "ui://infranodus/view.html";
const DEFAULT_API_URL = "https://infranodus.com";

export function createServer(): McpServer {
  const server = new McpServer({ name: "infranodus-mcp-app", version: "1.0.0" });

  registerAppResource(server, VIEW_URI, async () => {
    const html = fs.readFileSync(path.resolve(import.meta.dirname, "dist/mcp-app.html"), "utf-8");
    return { contents: [{ uri: VIEW_URI, mimeType: RESOURCE_MIME_TYPE, text: html,
      _meta: { ui: { csp: { connectDomains: ["https://infranodus.com", "https://*.infranodus.com"] } } }
    }] };
  });

  // ── analyze-text: text → knowledge graph ──────────────────────────────────
  registerAppTool(server, "analyze-text", {
    description: "Analyze text with InfraNodus to generate a knowledge graph showing topical clusters, gaps, and key concepts.",
    inputSchema: {
      text: z.string().describe("Text to analyze"),
      name: z.string().optional().describe("Context name"),
      api_key: z.string().optional().describe("InfraNodus API key"),
      api_url: z.string().optional(),
      context_mode: z.enum(["Concepts only","[[Wiki Links]] and Concepts","[[Wiki Links]] Only","[[Wiki Links]] Prioritized"]).optional(),
    },
    _meta: { ui: { resourceUri: VIEW_URI } },
  }, async ({ text, name, api_key, api_url, context_mode }) => {
    const apiKey = api_key || process.env.INFRANODUS_API_KEY || "";
    const apiUrl = api_url || process.env.INFRANODUS_API_URL || DEFAULT_API_URL;
    if (!apiKey) return { isError: true, content: [{ type: "text" as const, text: "Error: Set INFRANODUS_API_KEY or pass api_key." }] };

    try {
      const body: Record<string, unknown> = { name: name || "MCP Analysis", text };
      const csMap: Record<string, any> = {
        "[[Wiki Links]] and Concepts": { partOfSpeechToProcess: "HASHTAGS_AND_WORDS", doubleSquarebracketsProcessing: "PROCESS_AS_HASHTAGS" },
        "[[Wiki Links]] Only": { partOfSpeechToProcess: "HASHTAGS_ONLY", doubleSquarebracketsProcessing: "PROCESS_AS_HASHTAGS" },
        "[[Wiki Links]] Prioritized": { partOfSpeechToProcess: "WORDS_IF_NO_HASHTAGS", doubleSquarebracketsProcessing: "PROCESS_AS_HASHTAGS" },
        "Concepts only": { partOfSpeechToProcess: "HASHTAGS_AND_WORDS", doubleSquarebracketsProcessing: "EXCLUDE" },
      };
      body.contextSettings = csMap[context_mode || "Concepts only"];

      const resp = await fetch(`${apiUrl}/api/v1/graphAndStatements?doNotSave=true&addStats=true&dotGraph=true&optimize=develop`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
      });
      if (!resp.ok) throw new Error(`API ${resp.status}: ${resp.statusText}`);
      const data = await resp.json();

      const g = data?.entriesAndGraphOfContext?.graph?.graphologyGraph;
      const attr = g?.attributes || {};
      const topClusters = (attr.top_clusters || []).map((c: any) => ({
        id: c.community, words: c.nodes?.map((n: any) => n.nodeName) || [],
        numberRatio: c.numberRatio, bcRatio: c.bcRatio,
      }));
      const result = {
        contextName: name || "MCP Analysis", topClusters,
        topNodes: (attr.top_nodes || []).slice(0, 20),
        gaps: (attr.gaps || []).slice(0, 10),
        dotGraph: attr.dotGraph || "", bigrams: attr.bigrams || [],
        nodeCount: (g?.nodes || []).length, edgeCount: (g?.edges || []).length,
        statementCount: (data?.entriesAndGraphOfContext?.statements || []).length,
        statements: (data?.entriesAndGraphOfContext?.statements || []).slice(0, 30).map((s: any) => ({ id: s.id, content: s.content, community: s.topStatementCommunity })),
      };

      const clusterText = topClusters.map((c: any, i: number) => `  ${i+1}. ${c.words.slice(0,5).join(", ")}`).join("\n");
      const gapText = result.gaps.slice(0,5).map((g: any) => `  ${g.source||g[0]||"?"} ↔ ${g.target||g[1]||"?"}`).join("\n");

      return {
        structuredContent: { jsonrpc: "2.0", result },
        content: [{ type: "text" as const, text: `InfraNodus: ${result.nodeCount} nodes, ${result.edgeCount} edges\n\nClusters:\n${clusterText}\n\nGaps:\n${gapText||"  (none)"}\n\nTop: ${result.topNodes.slice(0,10).join(", ")}` }],
      };
    } catch (err: any) {
      return { isError: true, content: [{ type: "text" as const, text: `Error: ${err.message}` }] };
    }
  });

  // ── graph-ai-advice: get AI analysis of graph ─────────────────────────────
  registerAppTool(server, "graph-ai-advice", {
    description: "Get AI advice about an InfraNodus graph: summaries, gap analysis, research questions.",
    inputSchema: {
      prompt: z.string().describe("Question about the graph"),
      mode: z.enum(["summary","gaps","questions","connections","response"]).optional(),
      prompt_graph: z.string().optional(), prompt_context: z.string().optional(),
      api_key: z.string().optional(), api_url: z.string().optional(),
    },
    _meta: { ui: { resourceUri: VIEW_URI } },
  }, async ({ prompt, mode, prompt_graph, prompt_context, api_key, api_url }) => {
    const apiKey = api_key || process.env.INFRANODUS_API_KEY || "";
    const apiUrl = api_url || process.env.INFRANODUS_API_URL || DEFAULT_API_URL;
    if (!apiKey) return { isError: true, content: [{ type: "text" as const, text: "API key required." }] };
    try {
      const resp = await fetch(`${apiUrl}/api/v1/aiAdvice`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ mode: mode||"summary", prompt, promptGraph: prompt_graph||"", promptContext: prompt_context||"", extendedMode: "true", app: "mcp_app" }),
      });
      if (!resp.ok) throw new Error(`API ${resp.status}`);
      const data = await resp.json();
      const advice = data?.choices?.[0]?.text || JSON.stringify(data);
      return {
        structuredContent: { jsonrpc: "2.0", result: { advice, mode: mode||"summary" } },
        content: [{ type: "text" as const, text: advice }],
      };
    } catch (err: any) {
      return { isError: true, content: [{ type: "text" as const, text: `Error: ${err.message}` }] };
    }
  });

  // ── semantic-search: find related statements ──────────────────────────────
  registerAppTool(server, "semantic-search", {
    description: "Semantic search for related statements within text using InfraNodus AI.",
    inputSchema: {
      query: z.string().describe("Search query"),
      text: z.string().describe("Text to search within"),
      threshold: z.number().optional(), api_key: z.string().optional(), api_url: z.string().optional(),
    },
    _meta: { ui: { resourceUri: VIEW_URI } },
  }, async ({ query, text, threshold, api_key, api_url }) => {
    const apiKey = api_key || process.env.INFRANODUS_API_KEY || "";
    const apiUrl = api_url || process.env.INFRANODUS_API_URL || DEFAULT_API_URL;
    if (!apiKey) return { isError: true, content: [{ type: "text" as const, text: "API key required." }] };
    try {
      const resp = await fetch(`${apiUrl}/api/v1/aiSearch`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ mode: "aiSearch", embeddingType: "query", text, searchQuery: query, numberOfResults: 10, similarityThreshold: threshold||0.3 }),
      });
      if (!resp.ok) throw new Error(`API ${resp.status}`);
      const data = await resp.json();
      const results = data?.data?.results || data?.results || [];
      return {
        structuredContent: { jsonrpc: "2.0", result: { query, results, count: results.length } },
        content: [{ type: "text" as const, text: `Search "${query}": ${results.length} results\n` + results.slice(0,5).map((r: any, i: number) => `${i+1}. ${r.content||r.text||"?"}`).join("\n") }],
      };
    } catch (err: any) {
      return { isError: true, content: [{ type: "text" as const, text: `Error: ${err.message}` }] };
    }
  });

  return server;
}
