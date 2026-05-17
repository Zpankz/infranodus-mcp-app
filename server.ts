import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";

const VIEW_URI = "ui://infranodus/view.html";
const DEFAULT_API_URL = "https://infranodus.com";

// ── In-memory graph store ─────────────────────────────────────────────────
// Keeps the last N graphs so tools like graph-ai-advice and semantic-search
// can reference them without the caller re-sending text every time.
interface StoredGraph {
  name: string;
  text: string;
  result: any;            // the full structuredContent.result
  dotGraph: string;
  topNodesText: string;   // human-readable summary for AI context
  createdAt: string;
}
const graphStore = new Map<string, StoredGraph>();
const MAX_GRAPHS = 20;

function storeGraph(name: string, text: string, result: any) {
  if (graphStore.size >= MAX_GRAPHS) {
    const oldest = graphStore.keys().next().value;
    if (oldest) graphStore.delete(oldest);
  }
  const topNodesText = (result.topClusters || []).map((c: any, i: number) =>
    `Cluster ${i} (${c.words?.[0] || '?'}): ${c.words?.join(', ') || '(empty)'}`
  ).join('\n');
  graphStore.set(name, {
    name, text, result,
    dotGraph: result.dotGraph || '',
    topNodesText,
    createdAt: new Date().toISOString(),
  });
}

function getLatestGraph(): StoredGraph | undefined {
  let latest: StoredGraph | undefined;
  for (const g of graphStore.values()) latest = g;
  return latest;
}

export function createServer(): McpServer {
  const server = new McpServer({ name: "infranodus-mcp-app", version: "1.2.0" });

  registerAppResource(server, "InfraNodus View", VIEW_URI, {
    description: "Interactive InfraNodus knowledge graph view",
  }, async () => {
    const html = fs.readFileSync(path.resolve(import.meta.dirname, "dist/mcp-app.html"), "utf-8");
    return { contents: [{ uri: VIEW_URI, mimeType: RESOURCE_MIME_TYPE, text: html,
      _meta: { ui: { csp: { connectDomains: ["https://infranodus.com", "https://*.infranodus.com"] } } }
    }] };
  });

  // ══════════════════════════════════════════════════════════════════════════
  // analyze-text: text → knowledge graph
  // ══════════════════════════════════════════════════════════════════════════
  registerAppTool(server, "analyze-text", {
    description: "Analyze text with InfraNodus to generate a knowledge graph showing topical clusters, gaps, and key concepts. Returns nodes with betweenness centrality, edges with weights, cluster membership, structural gaps, and extended graph summary with main topics, content gaps, conceptual gateways, and diversity statistics.",
    inputSchema: {
      text: z.string().describe("Text to analyze"),
      name: z.string().optional().describe("Context name (used to reference this graph later)"),
      api_key: z.string().optional().describe("InfraNodus API key (falls back to INFRANODUS_API_KEY env var)"),
      api_url: z.string().optional(),
      context_mode: z.enum(["Concepts only","[[Wiki Links]] and Concepts","[[Wiki Links]] Only","[[Wiki Links]] Prioritized"]).optional(),
      ai_topics: z.boolean().optional().describe("Enable AI topic extraction (adds richer topic labels)"),
    },
    _meta: { ui: { resourceUri: VIEW_URI } },
  }, async ({ text, name, api_key, api_url, context_mode, ai_topics }) => {
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
      if (ai_topics) body.aiTopics = true;

      let queryParams = "doNotSave=true&addStats=true&dotGraph=true&optimize=develop&extendedGraphSummary=true";
      if (ai_topics) queryParams += "&aiTopics=true";

      const resp = await fetch(`${apiUrl}/api/v1/graphAndStatements?${queryParams}`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
      });
      if (!resp.ok) throw new Error(`API ${resp.status}: ${resp.statusText}`);
      const data = await resp.json();

      const g = data?.entriesAndGraphOfContext?.graph?.graphologyGraph;
      const attr = g?.attributes || {};
      const rawNodes = g?.nodes || [];
      const rawEdges = g?.edges || [];

      // ── Parse extended graph summary ──
      const extSummary = data?.extendedGraphSummary || {};
      const mainTopics = extSummary.mainTopics || [];
      const contentGaps = extSummary.contentGaps || [];
      const conceptualGateways = extSummary.conceptualGateways || [];
      const diversityStatistics = extSummary.diversityStatistics || {};
      const topicsToDevelop = extSummary.topicsToDevelop || [];

      // ── Parse clusters ──
      const topClusters = (attr.top_clusters || []).map((c: any) => ({
        id: parseInt(c.community ?? c.id ?? 0),
        words: c.nodes?.map((n: any) => n.nodeName) || [],
        numberRatio: c.numberRatio,
        bcRatio: c.bcRatio,
      }));

      // ── Parse gaps ──
      const rawGaps = attr.gaps || [];
      const gaps = rawGaps.map((gap: any) => {
        const fromComm = gap.from || gap.source || {};
        const toComm = gap.to || gap.target || {};
        const fromNodes = fromComm.nodes || [];
        const toNodes = toComm.nodes || [];
        const fromLabel = fromNodes.sort((a: any, b: any) => (b.bc || 0) - (a.bc || 0))[0]?.nodeName || `community ${fromComm.community || '?'}`;
        const toLabel = toNodes.sort((a: any, b: any) => (b.bc || 0) - (a.bc || 0))[0]?.nodeName || `community ${toComm.community || '?'}`;
        return {
          source: fromLabel, target: toLabel,
          sourceCluster: parseInt(fromComm.community ?? 0), targetCluster: parseInt(toComm.community ?? 0),
          sourceWords: fromNodes.map((n: any) => n.nodeName), targetWords: toNodes.map((n: any) => n.nodeName),
          distance: gap.distance, weightedDistance: gap.distanceWeighedBySize,
        };
      });

      // ── Build node array with centrality ──
      const graphNodes = rawNodes.map((n: any) => ({
        id: n.key || n.id,
        label: n.key || n.attributes?.label || n.id,
        community: n.attributes?.community ?? n.attributes?.cluster ?? 0,
        bc: n.attributes?.betweenness ?? n.attributes?.bc ?? 0,
        degree: n.attributes?.degree ?? n.attributes?.size ?? 1,
      }));

      // ── Build edge array ──
      const nodeIndex: Record<string, number> = {};
      graphNodes.forEach((n: any, i: number) => { nodeIndex[n.id] = i; });
      const graphEdges = rawEdges
        .map((e: any) => ({
          source: nodeIndex[e.source],
          target: nodeIndex[e.target],
          weight: e.attributes?.weight ?? 1,
        }))
        .filter((e: any) => e.source != null && e.target != null);

      // ── Compute modularity ──
      let intra = 0;
      graphEdges.forEach((e: any) => {
        if (graphNodes[e.source]?.community === graphNodes[e.target]?.community) intra++;
      });
      const modularity = graphEdges.length > 0 ? +(intra / graphEdges.length).toFixed(3) : 0;

      const result: any = {
        contextName: name || "MCP Analysis",
        topClusters, topNodes: (attr.top_nodes || []).slice(0, 30),
        gaps, dotGraph: attr.dotGraph || "", bigrams: attr.bigrams || [],
        nodeCount: graphNodes.length, edgeCount: graphEdges.length,
        clusterCount: topClusters.length, modularity,
        statementCount: (data?.entriesAndGraphOfContext?.statements || []).length,
        statements: (data?.entriesAndGraphOfContext?.statements || []).slice(0, 50).map((s: any) => ({
          id: s.id, content: s.content, community: s.topStatementCommunity,
        })),
        graphNodes, graphEdges,
        extendedGraphSummary: { mainTopics, contentGaps, conceptualGateways, diversityStatistics, topicsToDevelop },
      };

      storeGraph(name || "MCP Analysis", text, result);

      // ── Format text output ──
      const clusterText = topClusters.map((c: any, i: number) =>
        `  ${i+1}. [${c.words.slice(0,3).join(', ')}] (${c.words.length} nodes, ${(c.bcRatio*100).toFixed(0)}% centrality)`
      ).join("\n");

      const gapText = gaps.slice(0,5).map((gp: any) =>
        `  ${gp.source} ↔ ${gp.target} (clusters ${gp.sourceCluster}↔${gp.targetCluster}, dist: ${gp.distance?.toFixed(0) || '?'})`
      ).join("\n");

      const topNodeDetails = graphNodes
        .sort((a: any, b: any) => (b.bc || 0) - (a.bc || 0))
        .slice(0, 10)
        .map((n: any) => `  ${n.label} (bc: ${n.bc.toFixed(3)}, deg: ${n.degree}, cluster: ${n.community})`)
        .join("\n");

      const extSummaryText = mainTopics.length > 0
        ? `\nMain topics: ${mainTopics.slice(0, 10).map((t: any) => typeof t === 'string' ? t : t.name || t.topic || JSON.stringify(t)).join(', ')}` : '';
      const contentGapsText = contentGaps.length > 0
        ? `\nContent gaps: ${contentGaps.slice(0, 5).map((cg: any) => typeof cg === 'string' ? cg : cg.name || cg.gap || JSON.stringify(cg)).join(', ')}` : '';
      const gatewaysText = conceptualGateways.length > 0
        ? `\nConceptual gateways: ${conceptualGateways.slice(0, 5).map((gw: any) => typeof gw === 'string' ? gw : gw.name || JSON.stringify(gw)).join(', ')}` : '';

      return {
        structuredContent: { jsonrpc: "2.0", result },
        content: [{ type: "text" as const, text:
          `InfraNodus: ${result.nodeCount} nodes, ${result.edgeCount} edges, ${result.clusterCount} clusters, modularity: ${modularity}\n` +
          `\nClusters:\n${clusterText}\n` +
          `\nStructural gaps (${gaps.length}):\n${gapText || "  (none)"}\n` +
          `\nTop nodes by betweenness centrality:\n${topNodeDetails}\n` +
          `\nTop concepts: ${result.topNodes.slice(0,15).join(", ")}` +
          extSummaryText + contentGapsText + gatewaysText
        }],
      };
    } catch (err: any) {
      return { isError: true, content: [{ type: "text" as const, text: `Error: ${err.message}` }] };
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // graph-ai-advice: AI analysis grounded in graph data
  // Uses /api/v1/graphAndAdvice (text → graph → AI in one call) when
  // original text is available, or /api/v1/graphAiAdvice when re-querying
  // a stored graph object.
  // ══════════════════════════════════════════════════════════════════════════
  registerAppTool(server, "graph-ai-advice", {
    description: "Get AI advice grounded in an InfraNodus knowledge graph. Uses graphAndAdvice (text→graph→AI in one call) when text is available, or graphAiAdvice to re-query a stored graph. The AI response is grounded in the actual graph structure — clusters, gaps, and key nodes.",
    inputSchema: {
      prompt: z.string().describe("Question or instruction for the AI"),
      requestMode: z.enum(["question","summary","response","idea","challenge","fact","continue","transcend","paraphrase","outline","reprompt"]).optional().describe("AI response mode (default: summary)"),
      optimize: z.enum(["gaps","develop","reinforce","latent","imagine"]).optional().describe("Graph optimization strategy: gaps=bridge clusters, develop=expand topics, reinforce=strengthen existing, latent=hidden patterns, imagine=creative"),
      graph_name: z.string().optional().describe("Name of a previously-analyzed graph to reference (defaults to most recent)"),
      text: z.string().optional().describe("Original text to analyze and get advice on (if no stored graph)"),
      pinnedNodes: z.array(z.string()).optional().describe("Pin specific nodes/concepts to focus the AI on"),
      modelToUse: z.string().optional().describe("AI model to use (e.g. gpt-4)"),
      api_key: z.string().optional(),
      api_url: z.string().optional(),
    },
    _meta: { ui: { resourceUri: VIEW_URI } },
  }, async ({ prompt, requestMode, optimize, graph_name, text, pinnedNodes, modelToUse, api_key, api_url }) => {
    const apiKey = api_key || process.env.INFRANODUS_API_KEY || "";
    const apiUrl = api_url || process.env.INFRANODUS_API_URL || DEFAULT_API_URL;
    if (!apiKey) return { isError: true, content: [{ type: "text" as const, text: "API key required." }] };

    const stored = graph_name ? graphStore.get(graph_name) : getLatestGraph();
    const resolvedOptimize = optimize || "gaps";
    const resolvedMode = requestMode || "summary";

    try {
      let advice = "";
      let graphInfo: any = null;

      if (stored && stored.result?.graphNodes?.length > 0) {
        // ── Use graphAiAdvice: pass stored graph object for re-querying ──
        const graphPayload = {
          nodes: (stored.result.graphNodes || []).map((n: any) => ({
            key: n.id, attributes: { label: n.label, community: n.community, betweenness: n.bc, degree: n.degree },
          })),
          edges: (stored.result.graphEdges || []).map((e: any) => {
            const nodes = stored.result.graphNodes || [];
            return { source: nodes[e.source]?.id, target: nodes[e.target]?.id, attributes: { weight: e.weight } };
          }),
          attributes: {
            top_nodes: stored.result.topNodes || [],
            top_clusters: stored.result.topClusters || [],
            gaps: stored.result.gaps || [],
          },
        };
        const statements = (stored.result.statements || []).map((s: any) => ({
          id: s.id, content: s.content, community: s.community,
        }));

        const reqBody: Record<string, unknown> = {
          prompt,
          requestMode: resolvedMode,
          graph: graphPayload,
          statements,
        };
        if (pinnedNodes?.length) reqBody.pinnedNodes = pinnedNodes;
        if (modelToUse) reqBody.modelToUse = modelToUse;

        const resp = await fetch(`${apiUrl}/api/v1/graphAiAdvice?optimize=${resolvedOptimize}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify(reqBody),
        });
        if (!resp.ok) {
          const errBody = await resp.text().catch(() => "");
          throw new Error(`graphAiAdvice API ${resp.status}: ${errBody.slice(0, 300)}`);
        }
        const respData = await resp.json();
        const aiAdvice = respData?.aiAdvice || respData?.choices || [];
        advice = Array.isArray(aiAdvice)
          ? aiAdvice.map((a: any) => a.text || a.content || "").join("\n")
          : (typeof aiAdvice === 'string' ? aiAdvice : JSON.stringify(aiAdvice));
        graphInfo = { name: stored.name, nodeCount: stored.result.nodeCount, clusterCount: stored.result.clusterCount };

      } else {
        // ── Use graphAndAdvice: text → graph → AI in one call ──
        const sourceText = text || stored?.text;
        if (!sourceText) {
          return { isError: true, content: [{ type: "text" as const, text: "No text or stored graph available. Provide text or run analyze-text first." }] };
        }

        const reqBody: Record<string, unknown> = {
          text: sourceText,
          name: graph_name || stored?.name || "MCP Analysis",
          requestMode: resolvedMode,
          prompt,
        };
        if (pinnedNodes?.length) reqBody.pinnedNodes = pinnedNodes;
        if (modelToUse) reqBody.modelToUse = modelToUse;

        const resp = await fetch(`${apiUrl}/api/v1/graphAndAdvice?doNotSave=true&addStats=true&optimize=${resolvedOptimize}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify(reqBody),
        });
        if (!resp.ok) {
          const errBody = await resp.text().catch(() => "");
          throw new Error(`graphAndAdvice API ${resp.status}: ${errBody.slice(0, 300)}`);
        }
        const respData = await resp.json();
        const aiAdvice = respData?.aiAdvice || [];
        advice = Array.isArray(aiAdvice)
          ? aiAdvice.map((a: any) => a.text || a.content || "").join("\n")
          : (typeof aiAdvice === 'string' ? aiAdvice : JSON.stringify(aiAdvice));
        graphInfo = { fromAdviceCall: true };
      }

      const ctxNote = graphInfo?.name
        ? `[Grounded in graph "${graphInfo.name}" — ${graphInfo.nodeCount || '?'} nodes, ${graphInfo.clusterCount || '?'} clusters | mode: ${resolvedMode}, optimize: ${resolvedOptimize}]`
        : `[AI advice | mode: ${resolvedMode}, optimize: ${resolvedOptimize}]`;

      return {
        structuredContent: { jsonrpc: "2.0", result: { advice, requestMode: resolvedMode, optimize: resolvedOptimize, graphName: stored?.name || graph_name } },
        content: [{ type: "text" as const, text: `${ctxNote}\n\n${advice}` }],
      };
    } catch (err: any) {
      return { isError: true, content: [{ type: "text" as const, text: `Error: ${err.message}` }] };
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // semantic-search: search within text using embeddings
  // ══════════════════════════════════════════════════════════════════════════
  registerAppTool(server, "semantic-search", {
    description: "Semantic search for related passages within text. Splits text into sentences and finds those most similar to the query using embeddings. Can reference a previously-analyzed graph's text.",
    inputSchema: {
      query: z.string().describe("Search query"),
      text: z.string().optional().describe("Text to search within (if omitted, uses the most recent analyzed graph's text)"),
      graph_name: z.string().optional().describe("Name of a previously-analyzed graph whose text to search"),
      threshold: z.number().optional().describe("Similarity threshold 0-1 (default: 0.15)"),
      max_results: z.number().optional().describe("Maximum results to return (default: 10)"),
      api_key: z.string().optional(),
      api_url: z.string().optional(),
    },
    _meta: { ui: { resourceUri: VIEW_URI } },
  }, async ({ query, text, graph_name, threshold, max_results, api_key, api_url }) => {
    const apiKey = api_key || process.env.INFRANODUS_API_KEY || "";
    const apiUrl = api_url || process.env.INFRANODUS_API_URL || DEFAULT_API_URL;
    if (!apiKey) return { isError: true, content: [{ type: "text" as const, text: "API key required." }] };

    let searchText = text || "";
    if (!searchText) {
      const stored = graph_name ? graphStore.get(graph_name) : getLatestGraph();
      if (stored) searchText = stored.text;
    }
    if (!searchText) {
      return { isError: true, content: [{ type: "text" as const, text: "No text to search. Provide text directly or run analyze-text first." }] };
    }

    try {
      const resp = await fetch(`${apiUrl}/api/v1/aiSearch`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          mode: "aiSearch",
          embeddingType: "query",
          text: searchText,
          searchQuery: query,
          numberOfResults: max_results || 10,
          similarityThreshold: threshold ?? 0.15,
        }),
      });
      if (!resp.ok) {
        const errBody = await resp.text().catch(() => "");
        throw new Error(`API ${resp.status}: ${errBody.slice(0, 200)}`);
      }
      const data = await resp.json();

      // API returns array directly: [{similarity, matchedContent}, ...]
      const results = (Array.isArray(data) ? data : data?.data?.results || data?.results || [])
        .map((r: any) => ({
          content: r.matchedContent || r.content || r.text || "",
          similarity: r.similarity ?? r.score ?? 0,
        }))
        .filter((r: any) => r.content);

      const resultText = results.length === 0
        ? `Search "${query}": 0 results found (try lowering threshold or using different terms)`
        : `Search "${query}": ${results.length} results\n` +
          results.slice(0, max_results || 10).map((r: any, i: number) =>
            `${i+1}. [sim: ${r.similarity.toFixed(3)}] ${r.content}`
          ).join("\n");

      return {
        structuredContent: { jsonrpc: "2.0", result: { query, results, count: results.length } },
        content: [{ type: "text" as const, text: resultText }],
      };
    } catch (err: any) {
      return { isError: true, content: [{ type: "text" as const, text: `Error: ${err.message}` }] };
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // query-node: get details about a specific node in the graph
  // ══════════════════════════════════════════════════════════════════════════
  registerAppTool(server, "query-node", {
    description: "Query details about a specific concept/node in a previously-analyzed graph: its edges, cluster, centrality, and neighbors.",
    inputSchema: {
      node: z.string().describe("Node label/name to query"),
      graph_name: z.string().optional().describe("Graph name (defaults to most recent)"),
    },
    _meta: { ui: { resourceUri: VIEW_URI } },
  }, async ({ node, graph_name }) => {
    const stored = graph_name ? graphStore.get(graph_name) : getLatestGraph();
    if (!stored) {
      return { isError: true, content: [{ type: "text" as const, text: "No graph in memory. Run analyze-text first." }] };
    }

    const result = stored.result;
    const nodes: any[] = result.graphNodes || [];
    const edges: any[] = result.graphEdges || [];
    const searchLabel = node.toLowerCase();

    const nodeObj = nodes.find((n: any) => n.label?.toLowerCase() === searchLabel || n.id?.toLowerCase() === searchLabel);
    if (!nodeObj) {
      const available = nodes.slice(0, 20).map((n: any) => n.label).join(", ");
      return { isError: true, content: [{ type: "text" as const, text: `Node "${node}" not found. Available: ${available}...` }] };
    }

    const nodeIdx = nodes.indexOf(nodeObj);
    const neighbors: any[] = [];
    edges.forEach((e: any) => {
      if (e.source === nodeIdx && nodes[e.target]) {
        neighbors.push({ label: nodes[e.target].label, weight: e.weight, community: nodes[e.target].community });
      } else if (e.target === nodeIdx && nodes[e.source]) {
        neighbors.push({ label: nodes[e.source].label, weight: e.weight, community: nodes[e.source].community });
      }
    });

    const cluster = (result.topClusters || []).find((c: any) => c.id === nodeObj.community);
    const crossCluster = neighbors.filter((n: any) => n.community !== nodeObj.community);

    const detail = {
      label: nodeObj.label,
      community: nodeObj.community,
      clusterWords: cluster?.words || [],
      betweenness: nodeObj.bc,
      degree: nodeObj.degree || neighbors.length,
      neighborCount: neighbors.length,
      crossClusterEdges: crossCluster.length,
      neighbors: neighbors.sort((a: any, b: any) => (b.weight || 0) - (a.weight || 0)),
    };

    const detailText =
      `Node: ${detail.label}\n` +
      `Cluster: ${detail.community} (${detail.clusterWords.slice(0, 5).join(', ')})\n` +
      `Betweenness centrality: ${detail.betweenness.toFixed(4)}\n` +
      `Degree: ${detail.degree} (${detail.crossClusterEdges} cross-cluster)\n` +
      `\nNeighbors (${neighbors.length}):\n` +
      neighbors.map((n: any) => `  ${n.label} (cluster ${n.community}, w: ${n.weight?.toFixed(2) || '?'})`).join("\n");

    return {
      structuredContent: { jsonrpc: "2.0", result: detail },
      content: [{ type: "text" as const, text: detailText }],
    };
  });

  // ══════════════════════════════════════════════════════════════════════════
  // compare-graphs: structural comparison of two analyzed graphs
  // ══════════════════════════════════════════════════════════════════════════
  registerAppTool(server, "compare-graphs", {
    description: "Compare two previously-analyzed graphs to find shared concepts, unique concepts, structural differences, and cluster-level comparison.",
    inputSchema: {
      graph_a: z.string().describe("Name of first graph"),
      graph_b: z.string().describe("Name of second graph"),
    },
    _meta: { ui: { resourceUri: VIEW_URI } },
  }, async ({ graph_a, graph_b }) => {
    const a = graphStore.get(graph_a);
    const b = graphStore.get(graph_b);
    if (!a) return { isError: true, content: [{ type: "text" as const, text: `Graph "${graph_a}" not found. Available: ${[...graphStore.keys()].join(', ') || '(none)'}` }] };
    if (!b) return { isError: true, content: [{ type: "text" as const, text: `Graph "${graph_b}" not found. Available: ${[...graphStore.keys()].join(', ') || '(none)'}` }] };

    const labelsA = new Set((a.result.graphNodes || []).map((n: any) => n.label?.toLowerCase()));
    const labelsB = new Set((b.result.graphNodes || []).map((n: any) => n.label?.toLowerCase()));

    const shared = [...labelsA].filter(l => labelsB.has(l));
    const onlyA = [...labelsA].filter(l => !labelsB.has(l));
    const onlyB = [...labelsB].filter(l => !labelsA.has(l));

    // ── Cluster-level comparison ──
    const clustersA: any[] = a.result.topClusters || [];
    const clustersB: any[] = b.result.topClusters || [];

    const clusterComparison = clustersA.map((ca: any) => {
      const wordsA = new Set((ca.words || []).map((w: string) => w.toLowerCase()));
      let bestMatch: any = null;
      let bestOverlap = 0;
      clustersB.forEach((cb: any) => {
        const wordsB = (cb.words || []).map((w: string) => w.toLowerCase());
        const overlap = wordsB.filter((w: string) => wordsA.has(w)).length;
        if (overlap > bestOverlap) { bestOverlap = overlap; bestMatch = cb; }
      });
      return {
        clusterA: ca.words?.slice(0, 3) || [],
        clusterB: bestMatch?.words?.slice(0, 3) || [],
        sharedWords: bestOverlap,
        totalWordsA: ca.words?.length || 0,
      };
    });

    const comparison = {
      graphA: { name: graph_a, nodes: labelsA.size, clusters: a.result.clusterCount, modularity: a.result.modularity },
      graphB: { name: graph_b, nodes: labelsB.size, clusters: b.result.clusterCount, modularity: b.result.modularity },
      sharedConcepts: shared,
      uniqueToA: onlyA,
      uniqueToB: onlyB,
      overlapRatio: shared.length / Math.max(1, new Set([...labelsA, ...labelsB]).size),
      clusterComparison,
    };

    const clusterCompText = clusterComparison
      .filter((c: any) => c.sharedWords > 0)
      .map((c: any) => `  [${c.clusterA.join(', ')}] ↔ [${c.clusterB.join(', ')}] (${c.sharedWords} shared)`)
      .join("\n");

    const compText =
      `Graph comparison: "${graph_a}" vs "${graph_b}"\n\n` +
      `${graph_a}: ${labelsA.size} nodes, ${a.result.clusterCount} clusters, modularity: ${a.result.modularity}\n` +
      `${graph_b}: ${labelsB.size} nodes, ${b.result.clusterCount} clusters, modularity: ${b.result.modularity}\n\n` +
      `Shared concepts (${shared.length}): ${shared.slice(0, 20).join(', ')}\n\n` +
      `Only in ${graph_a} (${onlyA.length}): ${onlyA.slice(0, 15).join(', ')}\n\n` +
      `Only in ${graph_b} (${onlyB.length}): ${onlyB.slice(0, 15).join(', ')}\n\n` +
      `Overlap: ${(comparison.overlapRatio * 100).toFixed(1)}%` +
      (clusterCompText ? `\n\nCluster matches:\n${clusterCompText}` : '');

    return {
      structuredContent: { jsonrpc: "2.0", result: comparison },
      content: [{ type: "text" as const, text: compText }],
    };
  });

  // ══════════════════════════════════════════════════════════════════════════
  // export-graph: export in various formats
  // ══════════════════════════════════════════════════════════════════════════
  registerAppTool(server, "export-graph", {
    description: "Export a previously-analyzed graph as JSON (graphology), DOT, Mermaid, or CSV.",
    inputSchema: {
      format: z.enum(["json","dot","mermaid","csv"]).describe("Export format"),
      graph_name: z.string().optional().describe("Graph name (defaults to most recent)"),
    },
    _meta: { ui: { resourceUri: VIEW_URI } },
  }, async ({ format, graph_name }) => {
    const stored = graph_name ? graphStore.get(graph_name) : getLatestGraph();
    if (!stored) return { isError: true, content: [{ type: "text" as const, text: "No graph in memory. Run analyze-text first." }] };

    const { graphNodes: nodes, graphEdges: edges } = stored.result;
    let output = "";

    switch (format) {
      case "json": {
        output = JSON.stringify({
          attributes: { name: stored.name },
          nodes: nodes.map((n: any) => ({ key: n.id, attributes: { label: n.label, community: n.community, betweenness: n.bc, degree: n.degree } })),
          edges: edges.map((e: any) => ({ source: nodes[e.source]?.id, target: nodes[e.target]?.id, attributes: { weight: e.weight } })),
        }, null, 2);
        break;
      }
      case "dot": {
        if (stored.dotGraph) { output = stored.dotGraph; break; }
        const lines = ['digraph {'];
        nodes.forEach((n: any) => lines.push(`  "${n.label}" [cluster=${n.community}];`));
        edges.forEach((e: any) => {
          if (nodes[e.source] && nodes[e.target])
            lines.push(`  "${nodes[e.source].label}" -> "${nodes[e.target].label}" [weight=${e.weight}];`);
        });
        lines.push('}');
        output = lines.join('\n');
        break;
      }
      case "mermaid": {
        const lines = ['graph LR'];
        const seen = new Set<string>();
        edges.forEach((e: any) => {
          const sa = nodes[e.source]?.label, sb = nodes[e.target]?.label;
          if (sa && sb) {
            const key = `${sa}-${sb}`;
            if (!seen.has(key)) { seen.add(key); lines.push(`  ${sa.replace(/\s/g,'_')} --> ${sb.replace(/\s/g,'_')}`); }
          }
        });
        output = lines.join('\n');
        break;
      }
      case "csv": {
        const lines = ['source,target,weight,source_cluster,target_cluster'];
        edges.forEach((e: any) => {
          const sa = nodes[e.source], sb = nodes[e.target];
          if (sa && sb) lines.push(`"${sa.label}","${sb.label}",${e.weight},${sa.community},${sb.community}`);
        });
        output = lines.join('\n');
        break;
      }
    }

    return {
      structuredContent: { jsonrpc: "2.0", result: { format, graphName: stored.name, output } },
      content: [{ type: "text" as const, text: output }],
    };
  });

  // ══════════════════════════════════════════════════════════════════════════
  // list-graphs: list graphs from InfraNodus API + in-memory session
  // ══════════════════════════════════════════════════════════════════════════
  registerAppTool(server, "list-graphs", {
    description: "List graphs from InfraNodus (saved on server) and/or from the current session (in-memory). Uses the /api/v1/listGraphs API endpoint with optional filtering.",
    inputSchema: {
      query: z.string().optional().describe("Filter graphs by name/description"),
      type: z.string().optional().describe("Filter by context type"),
      favorite: z.boolean().optional().describe("Filter by favorite status"),
      session_only: z.boolean().optional().describe("Only list in-memory session graphs (skip API call)"),
      api_key: z.string().optional(),
      api_url: z.string().optional(),
    },
    _meta: { ui: { resourceUri: VIEW_URI } },
  }, async ({ query, type, favorite, session_only, api_key, api_url }) => {
    const sessionGraphs = [...graphStore.values()].map(sg => ({
      name: sg.name,
      source: "session" as const,
      nodeCount: sg.result?.nodeCount ?? 0,
      edgeCount: sg.result?.edgeCount ?? 0,
      clusterCount: sg.result?.clusterCount ?? 0,
      createdAt: sg.createdAt,
    }));

    let serverGraphs: any[] = [];

    if (!session_only) {
      const resolvedApiKey = api_key || process.env.INFRANODUS_API_KEY || "";
      const resolvedApiUrl = api_url || process.env.INFRANODUS_API_URL || DEFAULT_API_URL;

      if (resolvedApiKey) {
        try {
          const reqBody: Record<string, unknown> = {};
          if (query) reqBody.query = query;
          if (type) reqBody.type = type;
          if (favorite !== undefined) reqBody.favorite = favorite;

          const resp = await fetch(`${resolvedApiUrl}/api/v1/listGraphs`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${resolvedApiKey}` },
            body: JSON.stringify(reqBody),
          });
          if (resp.ok) {
            const data = await resp.json();
            const rawGraphs = Array.isArray(data) ? data : data?.graphs || data?.data || [];
            serverGraphs = rawGraphs.map((sg: any) => ({
              id: sg.id,
              name: sg.contextName || sg.name,
              source: "server" as const,
              contextType: sg.contextType,
              createdAt: sg.createdAt,
              description: sg.description,
              isFavorite: sg.isFavorite,
            }));
          }
        } catch (_err) {
          // Silently fall back to session-only
        }
      }
    }

    const allGraphs = [...sessionGraphs, ...serverGraphs];

    let listText = "";
    if (allGraphs.length === 0) {
      listText = "No graphs found. Use analyze-text to create one.";
    } else {
      listText = `Graphs (${allGraphs.length}):`;
      if (sessionGraphs.length > 0) {
        listText += "\n\n── Session ──\n" +
          sessionGraphs.map((sg, i) => `  ${i+1}. ${sg.name} (${sg.nodeCount} nodes, ${sg.clusterCount} clusters, ${sg.createdAt})`).join("\n");
      }
      if (serverGraphs.length > 0) {
        listText += "\n\n── Server ──\n" +
          serverGraphs.map((sg: any, i: number) => `  ${i+1}. ${sg.name}${sg.contextType ? ` [${sg.contextType}]` : ''}${sg.isFavorite ? ' ★' : ''} (${sg.createdAt || '?'})`).join("\n");
      }
    }

    return {
      structuredContent: { jsonrpc: "2.0", result: { sessionGraphs, serverGraphs, totalCount: allGraphs.length } },
      content: [{ type: "text" as const, text: listText }],
    };
  });

  // ══════════════════════════════════════════════════════════════════════════
  // search-graphs: search across saved graphs on the server
  // ══════════════════════════════════════════════════════════════════════════
  registerAppTool(server, "search-graphs", {
    description: "Search across saved InfraNodus graphs on the server. Finds graphs and nodes matching the query.",
    inputSchema: {
      query: z.string().describe("Search query"),
      contextNames: z.array(z.string()).optional().describe("Limit search to specific graph names"),
      maxNodes: z.number().optional().describe("Maximum nodes to return (default: 20)"),
      api_key: z.string().optional(),
      api_url: z.string().optional(),
    },
    _meta: { ui: { resourceUri: VIEW_URI } },
  }, async ({ query, contextNames, maxNodes, api_key, api_url }) => {
    const apiKey = api_key || process.env.INFRANODUS_API_KEY || "";
    const apiUrl = api_url || process.env.INFRANODUS_API_URL || DEFAULT_API_URL;
    if (!apiKey) return { isError: true, content: [{ type: "text" as const, text: "API key required." }] };

    try {
      const reqBody: Record<string, unknown> = { query };
      if (contextNames?.length) reqBody.contextNames = contextNames;
      if (maxNodes) reqBody.maxNodes = maxNodes;

      const resp = await fetch(`${apiUrl}/api/v1/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(reqBody),
      });
      if (!resp.ok) {
        const errBody = await resp.text().catch(() => "");
        throw new Error(`API ${resp.status}: ${errBody.slice(0, 200)}`);
      }
      const data = await resp.json();
      const results = Array.isArray(data) ? data : data?.results || data?.data || [];

      const searchResultText = results.length === 0
        ? `Search "${query}": no results found across saved graphs.`
        : `Search "${query}": ${results.length} results\n` +
          results.slice(0, maxNodes || 20).map((r: any, i: number) =>
            `  ${i+1}. ${r.contextName || r.graph || '?'}: ${r.nodeName || r.content || r.text || JSON.stringify(r).slice(0, 100)}`
          ).join("\n");

      return {
        structuredContent: { jsonrpc: "2.0", result: { query, results, count: results.length } },
        content: [{ type: "text" as const, text: searchResultText }],
      };
    } catch (err: any) {
      return { isError: true, content: [{ type: "text" as const, text: `Error: ${err.message}` }] };
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // add-text: incrementally add text to an existing graph
  // ══════════════════════════════════════════════════════════════════════════
  registerAppTool(server, "add-text", {
    description: "Add more text to an existing analyzed graph, merging the new concepts into the existing structure. Creates a combined analysis.",
    inputSchema: {
      text: z.string().describe("Additional text to add"),
      graph_name: z.string().optional().describe("Graph to add to (defaults to most recent)"),
      api_key: z.string().optional(),
      api_url: z.string().optional(),
    },
    _meta: { ui: { resourceUri: VIEW_URI } },
  }, async ({ text, graph_name, api_key, api_url }) => {
    const stored = graph_name ? graphStore.get(graph_name) : getLatestGraph();
    if (!stored) return { isError: true, content: [{ type: "text" as const, text: "No graph to add to. Run analyze-text first." }] };

    const combinedText = stored.text + "\n\n" + text;
    const apiKey = api_key || process.env.INFRANODUS_API_KEY || "";
    const apiUrl = api_url || process.env.INFRANODUS_API_URL || DEFAULT_API_URL;
    if (!apiKey) return { isError: true, content: [{ type: "text" as const, text: "API key required." }] };

    try {
      const resp = await fetch(`${apiUrl}/api/v1/graphAndStatements?doNotSave=true&addStats=true&dotGraph=true&optimize=develop`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ name: stored.name, text: combinedText }),
      });
      if (!resp.ok) throw new Error(`API ${resp.status}: ${resp.statusText}`);
      const data = await resp.json();

      const g = data?.entriesAndGraphOfContext?.graph?.graphologyGraph;
      const attr = g?.attributes || {};
      const rawNodes = g?.nodes || [];
      const rawEdges = g?.edges || [];
      const prevNodeCount = stored.result?.nodeCount || 0;

      const topClusters = (attr.top_clusters || []).map((c: any) => ({
        id: parseInt(c.community ?? 0),
        words: c.nodes?.map((n: any) => n.nodeName) || [],
        numberRatio: c.numberRatio, bcRatio: c.bcRatio,
      }));
      const rawGaps = attr.gaps || [];
      const gaps = rawGaps.map((gap: any) => {
        const fromNodes = (gap.from?.nodes || []).sort((a: any, b: any) => (b.bc || 0) - (a.bc || 0));
        const toNodes = (gap.to?.nodes || []).sort((a: any, b: any) => (b.bc || 0) - (a.bc || 0));
        return {
          source: fromNodes[0]?.nodeName || '?', target: toNodes[0]?.nodeName || '?',
          sourceCluster: parseInt(gap.from?.community ?? 0), targetCluster: parseInt(gap.to?.community ?? 0),
          sourceWords: fromNodes.map((n: any) => n.nodeName), targetWords: toNodes.map((n: any) => n.nodeName),
          distance: gap.distance, weightedDistance: gap.distanceWeighedBySize,
        };
      });
      const graphNodes = rawNodes.map((n: any) => ({
        id: n.key || n.id, label: n.key || n.attributes?.label || n.id,
        community: n.attributes?.community ?? 0, bc: n.attributes?.betweenness ?? 0,
        degree: n.attributes?.degree ?? 1,
      }));
      const nodeIndex: Record<string, number> = {};
      graphNodes.forEach((n: any, i: number) => { nodeIndex[n.id] = i; });
      const graphEdges = rawEdges.map((e: any) => ({ source: nodeIndex[e.source], target: nodeIndex[e.target], weight: e.attributes?.weight ?? 1 }))
        .filter((e: any) => e.source != null && e.target != null);
      let intra = 0;
      graphEdges.forEach((e: any) => { if (graphNodes[e.source]?.community === graphNodes[e.target]?.community) intra++; });

      const result: any = {
        contextName: stored.name, topClusters, topNodes: (attr.top_nodes || []).slice(0, 30),
        gaps, dotGraph: attr.dotGraph || "", bigrams: attr.bigrams || [],
        nodeCount: graphNodes.length, edgeCount: graphEdges.length, clusterCount: topClusters.length,
        modularity: graphEdges.length > 0 ? +(intra / graphEdges.length).toFixed(3) : 0,
        statementCount: (data?.entriesAndGraphOfContext?.statements || []).length,
        statements: (data?.entriesAndGraphOfContext?.statements || []).slice(0, 50).map((s: any) => ({ id: s.id, content: s.content, community: s.topStatementCommunity })),
        graphNodes, graphEdges,
      };

      storeGraph(stored.name, combinedText, result);

      return {
        structuredContent: { jsonrpc: "2.0", result },
        content: [{ type: "text" as const, text:
          `Added text to "${stored.name}": ${prevNodeCount} → ${result.nodeCount} nodes, ${result.edgeCount} edges, ${result.clusterCount} clusters` }],
      };
    } catch (err: any) {
      return { isError: true, content: [{ type: "text" as const, text: `Error: ${err.message}` }] };
    }
  });

  return server;
}
