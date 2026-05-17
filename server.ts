import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";

const VIEW_URI = "ui://infranodus/view.html";
const DEFAULT_API_URL = "https://infranodus.com";

export function createServer(): McpServer {
  const server = new McpServer({ name: "infranodus-mcp-app", version: "1.0.0" });

  registerAppResource(server, "InfraNodus View", VIEW_URI, {
    description: "Interactive InfraNodus knowledge graph view",
  }, async () => {
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
      const rawNodes = g?.nodes || [];
      const rawEdges = g?.edges || [];
      const topClusters = (attr.top_clusters || []).map((c: any) => ({
        id: c.community, words: c.nodes?.map((n: any) => n.nodeName) || [],
        numberRatio: c.numberRatio, bcRatio: c.bcRatio,
        topStatementId: c.topStatementId,
      }));

      // Build node array with centrality and community for the view
      const graphNodes = rawNodes.map((n: any) => ({
        id: n.key || n.id,
        label: n.key || n.attributes?.label || n.id,
        community: n.attributes?.community ?? n.attributes?.cluster ?? 0,
        bc: n.attributes?.betweenness ?? n.attributes?.bc ?? 0,
        size: n.attributes?.size ?? n.attributes?.degree ?? 1,
      }));

      // Build edge array with source/target indices
      const nodeIndex: Record<string, number> = {};
      graphNodes.forEach((n: any, i: number) => { nodeIndex[n.id] = i; });
      const graphEdges = rawEdges
        .map((e: any) => ({ si: nodeIndex[e.source], ti: nodeIndex[e.target], w: e.attributes?.weight ?? 1 }))
        .filter((e: any) => e.si != null && e.ti != null);

      const result = {
        contextName: name || "MCP Analysis",
        topClusters,
        topNodes: (attr.top_nodes || []).slice(0, 30),
        gaps: (attr.gaps || []).slice(0, 15),
        dotGraph: attr.dotGraph || "",
        bigrams: attr.bigrams || [],
        nodeCount: graphNodes.length,
        edgeCount: graphEdges.length,
        statementCount: (data?.entriesAndGraphOfContext?.statements || []).length,
        statements: (data?.entriesAndGraphOfContext?.statements || []).slice(0, 50).map((s: any) => ({
          id: s.id, content: s.content, community: s.topStatementCommunity,
        })),
        // Raw graph data for the force-directed visualization
        graphNodes,
        graphEdges,
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

  // ── graph-ai-advice ───────────────────────────────────────────────────────
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

  // ── semantic-search ───────────────────────────────────────────────────────
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

  // ── compose-query: natural language → tool call plan ───────────────────
  registerAppTool(server, "compose-query", {
    description: "Compile a natural language query into a structured plan of InfraNodus tool calls to execute.",
    inputSchema: {
      query: z.string().describe("Natural language query to compile into a tool plan"),
      graph_context: z.string().optional().describe("Optional graph/context name to scope the query"),
    },
    _meta: { ui: { resourceUri: VIEW_URI } },
  }, async ({ query, graph_context }) => {
    const q = query.toLowerCase();
    const steps: Array<{ tool: string; arguments: Record<string, unknown>; reason: string }> = [];

    // Keyword-based compilation heuristics
    const wantsAnalysis = /analyz|graph|cluster|map|visuali|knowledge|topic|concept/.test(q);
    const wantsGaps = /gap|bridge|missing|blind spot|unexplored/.test(q);
    const wantsSummary = /summar|overview|tldr|explain|describe/.test(q);
    const wantsQuestions = /question|research|inquir|ask/.test(q);
    const wantsSearch = /search|find|look.*for|related|similar/.test(q);
    const wantsList = /list.*graph|my graph|saved graph|all graph|show.*graph/.test(q);
    const wantsConnections = /connect|relat|link|between/.test(q);

    // Extract text content if query contains "text:" or quoted content
    const textMatch = query.match(/text:\s*["']([^"']+)["']/i) || query.match(/["']([^"']{20,})["']/i);
    const extractedText = textMatch?.[1];

    if (wantsList) {
      steps.push({
        tool: "list-graphs",
        arguments: {},
        reason: "List available saved graphs",
      });
    }

    if (wantsAnalysis && extractedText) {
      steps.push({
        tool: "analyze-text",
        arguments: {
          text: extractedText,
          ...(graph_context ? { name: graph_context } : {}),
        },
        reason: "Analyze the provided text to generate a knowledge graph",
      });
    } else if (wantsAnalysis) {
      steps.push({
        tool: "analyze-text",
        arguments: {
          text: "(provide text to analyze)",
          ...(graph_context ? { name: graph_context } : {}),
        },
        reason: "Text analysis requested — provide text content to proceed",
      });
    }

    if (wantsSearch) {
      const searchQuery = query.replace(/search|find|look.*for|related|similar/gi, "").trim();
      steps.push({
        tool: "semantic-search",
        arguments: {
          query: searchQuery || query,
          text: extractedText || "(provide text to search within)",
        },
        reason: "Semantic search for relevant statements",
      });
    }

    if (wantsGaps) {
      steps.push({
        tool: "graph-ai-advice",
        arguments: {
          prompt: query,
          mode: "gaps" as const,
          ...(graph_context ? { prompt_context: graph_context } : {}),
        },
        reason: "Identify structural gaps and blind spots in the knowledge graph",
      });
    }

    if (wantsSummary) {
      steps.push({
        tool: "graph-ai-advice",
        arguments: {
          prompt: query,
          mode: "summary" as const,
          ...(graph_context ? { prompt_context: graph_context } : {}),
        },
        reason: "Generate a summary of the graph content",
      });
    }

    if (wantsQuestions) {
      steps.push({
        tool: "graph-ai-advice",
        arguments: {
          prompt: query,
          mode: "questions" as const,
          ...(graph_context ? { prompt_context: graph_context } : {}),
        },
        reason: "Generate research questions from the graph structure",
      });
    }

    if (wantsConnections && !wantsGaps) {
      steps.push({
        tool: "graph-ai-advice",
        arguments: {
          prompt: query,
          mode: "connections" as const,
          ...(graph_context ? { prompt_context: graph_context } : {}),
        },
        reason: "Explore connections between concepts in the graph",
      });
    }

    // Fallback: if no keywords matched, default to a summary
    if (steps.length === 0) {
      steps.push({
        tool: "graph-ai-advice",
        arguments: {
          prompt: query,
          mode: "response" as const,
          ...(graph_context ? { prompt_context: graph_context } : {}),
        },
        reason: "General query — using AI advice to respond",
      });
    }

    const plan = {
      query,
      graphContext: graph_context || null,
      steps,
      stepCount: steps.length,
    };

    const planText = steps.map((s, i) =>
      `${i + 1}. ${s.tool} — ${s.reason}`
    ).join("\n");

    return {
      structuredContent: { jsonrpc: "2.0" as const, result: plan },
      content: [{
        type: "text" as const,
        text: `Query plan (${steps.length} step${steps.length === 1 ? "" : "s"}):\n${planText}`,
      }],
    };
  });

  // ── list-graphs: fetch saved graphs from InfraNodus ────────────────────
  registerAppTool(server, "list-graphs", {
    description: "List available saved knowledge graphs from InfraNodus.",
    inputSchema: {
      api_key: z.string().optional().describe("InfraNodus API key"),
      api_url: z.string().optional().describe("InfraNodus API base URL"),
    },
    _meta: { ui: { resourceUri: VIEW_URI } },
  }, async ({ api_key, api_url }) => {
    const apiKey = api_key || process.env.INFRANODUS_API_KEY || "";
    const apiUrl = api_url || process.env.INFRANODUS_API_URL || DEFAULT_API_URL;
    if (!apiKey) {
      return { isError: true, content: [{ type: "text" as const, text: "Error: Set INFRANODUS_API_KEY or pass api_key." }] };
    }
    try {
      const resp = await fetch(`${apiUrl}/api/v1/contexts`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      });
      if (!resp.ok) throw new Error(`API ${resp.status}: ${resp.statusText}`);
      const data = await resp.json();

      // The API may return contexts under different shapes
      const contexts: any[] = data?.contexts || data?.data?.contexts || data?.data || [];
      const graphs = contexts.map((ctx: any) => ({
        id: ctx.id || ctx._id,
        name: ctx.name || ctx.title || ctx.contextName,
        nodeCount: ctx.nodeCount ?? ctx.node_count ?? null,
        edgeCount: ctx.edgeCount ?? ctx.edge_count ?? null,
        createdAt: ctx.createdAt || ctx.created_at || null,
        updatedAt: ctx.updatedAt || ctx.updated_at || null,
      }));

      const listText = graphs.length === 0
        ? "No saved graphs found."
        : graphs.map((g: any, i: number) =>
            `${i + 1}. ${g.name}${g.nodeCount != null ? ` (${g.nodeCount} nodes)` : ""}`
          ).join("\n");

      return {
        structuredContent: { jsonrpc: "2.0" as const, result: { graphs, count: graphs.length } },
        content: [{ type: "text" as const, text: `Saved graphs (${graphs.length}):\n${listText}` }],
      };
    } catch (err: any) {
      return { isError: true, content: [{ type: "text" as const, text: `Error: ${err.message}` }] };
    }
  });

  return server;
}
