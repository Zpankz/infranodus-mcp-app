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
  const server = new McpServer({ name: "infranodus-mcp-app", version: "1.1.0" });

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
    description: "Analyze text with InfraNodus to generate a knowledge graph showing topical clusters, gaps, and key concepts. Returns nodes with betweenness centrality, edges with weights, cluster membership, and structural gaps between communities.",
    inputSchema: {
      text: z.string().describe("Text to analyze"),
      name: z.string().optional().describe("Context name (used to reference this graph later)"),
      api_key: z.string().optional().describe("InfraNodus API key (falls back to INFRANODUS_API_KEY env var)"),
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

      // ── Parse clusters ──
      const topClusters = (attr.top_clusters || []).map((c: any) => ({
        id: parseInt(c.community ?? c.id ?? 0),
        words: c.nodes?.map((n: any) => n.nodeName) || [],
        numberRatio: c.numberRatio,
        bcRatio: c.bcRatio,
      }));

      // ── Parse gaps (from/to community structure → source/target labels) ──
      const rawGaps = attr.gaps || [];
      const gaps = rawGaps.map((gap: any) => {
        const fromComm = gap.from || gap.source || {};
        const toComm = gap.to || gap.target || {};
        const fromNodes = fromComm.nodes || [];
        const toNodes = toComm.nodes || [];
        // Use the top node (highest bc) from each community as the label
        const fromLabel = fromNodes.sort((a: any, b: any) => (b.bc || 0) - (a.bc || 0))[0]?.nodeName || `community ${fromComm.community || '?'}`;
        const toLabel = toNodes.sort((a: any, b: any) => (b.bc || 0) - (a.bc || 0))[0]?.nodeName || `community ${toComm.community || '?'}`;
        return {
          source: fromLabel,
          target: toLabel,
          sourceCluster: parseInt(fromComm.community ?? 0),
          targetCluster: parseInt(toComm.community ?? 0),
          sourceWords: fromNodes.map((n: any) => n.nodeName),
          targetWords: toNodes.map((n: any) => n.nodeName),
          distance: gap.distance,
          weightedDistance: gap.distanceWeighedBySize,
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

      // ── Compute modularity (ratio of intra-cluster edges) ──
      let intra = 0;
      graphEdges.forEach((e: any) => {
        if (graphNodes[e.source]?.community === graphNodes[e.target]?.community) intra++;
      });
      const modularity = graphEdges.length > 0 ? +(intra / graphEdges.length).toFixed(3) : 0;

      const result: any = {
        contextName: name || "MCP Analysis",
        topClusters,
        topNodes: (attr.top_nodes || []).slice(0, 30),
        gaps,
        dotGraph: attr.dotGraph || "",
        bigrams: attr.bigrams || [],
        nodeCount: graphNodes.length,
        edgeCount: graphEdges.length,
        clusterCount: topClusters.length,
        modularity,
        statementCount: (data?.entriesAndGraphOfContext?.statements || []).length,
        statements: (data?.entriesAndGraphOfContext?.statements || []).slice(0, 50).map((s: any) => ({
          id: s.id, content: s.content, community: s.topStatementCommunity,
        })),
        graphNodes,
        graphEdges,
      };

      // Store for later reference by other tools
      storeGraph(name || "MCP Analysis", text, result);

      // ── Format text output ──
      const clusterText = topClusters.map((c: any, i: number) =>
        `  ${i+1}. [${c.words.slice(0,3).join(', ')}] (${c.words.length} nodes, ${(c.bcRatio*100).toFixed(0)}% centrality)`
      ).join("\n");

      const gapText = gaps.slice(0,5).map((g: any) =>
        `  ${g.source} ↔ ${g.target} (clusters ${g.sourceCluster}↔${g.targetCluster}, dist: ${g.distance?.toFixed(0) || '?'})`
      ).join("\n");

      const topNodeDetails = graphNodes
        .sort((a: any, b: any) => (b.bc || 0) - (a.bc || 0))
        .slice(0, 10)
        .map((n: any) => `  ${n.label} (bc: ${n.bc.toFixed(3)}, deg: ${n.degree}, cluster: ${n.community})`)
        .join("\n");

      return {
        structuredContent: { jsonrpc: "2.0", result },
        content: [{ type: "text" as const, text:
          `InfraNodus: ${result.nodeCount} nodes, ${result.edgeCount} edges, ${result.clusterCount} clusters, modularity: ${modularity}\n` +
          `\nClusters:\n${clusterText}\n` +
          `\nStructural gaps (${gaps.length}):\n${gapText || "  (none)"}\n` +
          `\nTop nodes by betweenness centrality:\n${topNodeDetails}\n` +
          `\nTop concepts: ${result.topNodes.slice(0,15).join(", ")}`
        }],
      };
    } catch (err: any) {
      return { isError: true, content: [{ type: "text" as const, text: `Error: ${err.message}` }] };
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // graph-ai-advice: AI analysis grounded in graph data
  // ══════════════════════════════════════════════════════════════════════════
  registerAppTool(server, "graph-ai-advice", {
    description: "Get AI advice grounded in a previously-analyzed InfraNodus graph. Passes the graph's DOT representation and cluster/node data as context. Modes: summary, gaps, questions, connections, response.",
    inputSchema: {
      prompt: z.string().describe("Question about the graph"),
      mode: z.enum(["summary","gaps","questions","connections","response"]).optional().describe("Analysis mode (default: summary)"),
      graph_name: z.string().optional().describe("Name of a previously-analyzed graph to reference (defaults to most recent)"),
      prompt_graph: z.string().optional().describe("DOT graph string to pass as context (auto-filled from stored graph if omitted)"),
      prompt_context: z.string().optional().describe("Additional text context (auto-filled from stored graph if omitted)"),
      api_key: z.string().optional(),
      api_url: z.string().optional(),
    },
    _meta: { ui: { resourceUri: VIEW_URI } },
  }, async ({ prompt, mode, graph_name, prompt_graph, prompt_context, api_key, api_url }) => {
    const apiKey = api_key || process.env.INFRANODUS_API_KEY || "";
    const apiUrl = api_url || process.env.INFRANODUS_API_URL || DEFAULT_API_URL;
    if (!apiKey) return { isError: true, content: [{ type: "text" as const, text: "API key required." }] };

    // Auto-fill graph context from store if not provided
    let graphCtx = prompt_graph || "";
    let textCtx = prompt_context || "";
    const stored = graph_name ? graphStore.get(graph_name) : getLatestGraph();
    if (stored && !graphCtx) {
      graphCtx = stored.dotGraph || stored.topNodesText;
    }
    if (stored && !textCtx) {
      textCtx = stored.topNodesText;
    }

    try {
      const resp = await fetch(`${apiUrl}/api/v1/aiAdvice`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          mode: mode || "summary",
          prompt,
          promptGraph: graphCtx,
          promptContext: textCtx,
          extendedMode: "true",
          app: "mcp_app",
        }),
      });
      if (!resp.ok) {
        const errBody = await resp.text().catch(() => "");
        throw new Error(`API ${resp.status}: ${errBody.slice(0, 200)}`);
      }
      const data = await resp.json();
      const advice = data?.choices?.[0]?.text || data?.result || JSON.stringify(data);

      // Also include what graph context was used
      const ctxNote = stored
        ? `[Grounded in graph "${stored.name}" — ${stored.result?.nodeCount || '?'} nodes, ${stored.result?.clusterCount || '?'} clusters]`
        : "[No stored graph context — pass graph_name or run analyze-text first]";

      return {
        structuredContent: { jsonrpc: "2.0", result: { advice, mode: mode || "summary", graphName: stored?.name } },
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

    // Get text from store if not provided
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

    const text =
      `Node: ${detail.label}\n` +
      `Cluster: ${detail.community} (${detail.clusterWords.slice(0, 5).join(', ')})\n` +
      `Betweenness centrality: ${detail.betweenness.toFixed(4)}\n` +
      `Degree: ${detail.degree} (${detail.crossClusterEdges} cross-cluster)\n` +
      `\nNeighbors (${neighbors.length}):\n` +
      neighbors.map((n: any) => `  ${n.label} (cluster ${n.community}, w: ${n.weight?.toFixed(2) || '?'})`).join("\n");

    return {
      structuredContent: { jsonrpc: "2.0", result: detail },
      content: [{ type: "text" as const, text }],
    };
  });

  // ══════════════════════════════════════════════════════════════════════════
  // compare-graphs: structural comparison of two analyzed graphs
  // ══════════════════════════════════════════════════════════════════════════
  registerAppTool(server, "compare-graphs", {
    description: "Compare two previously-analyzed graphs to find shared concepts, unique concepts, and structural differences.",
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

    const comparison = {
      graphA: { name: graph_a, nodes: labelsA.size, clusters: a.result.clusterCount, modularity: a.result.modularity },
      graphB: { name: graph_b, nodes: labelsB.size, clusters: b.result.clusterCount, modularity: b.result.modularity },
      sharedConcepts: shared,
      uniqueToA: onlyA,
      uniqueToB: onlyB,
      overlapRatio: shared.length / Math.max(1, new Set([...labelsA, ...labelsB]).size),
    };

    const text =
      `Graph comparison: "${graph_a}" vs "${graph_b}"\n\n` +
      `${graph_a}: ${labelsA.size} nodes, ${a.result.clusterCount} clusters\n` +
      `${graph_b}: ${labelsB.size} nodes, ${b.result.clusterCount} clusters\n\n` +
      `Shared concepts (${shared.length}): ${shared.slice(0, 20).join(', ')}\n\n` +
      `Only in ${graph_a} (${onlyA.length}): ${onlyA.slice(0, 15).join(', ')}\n\n` +
      `Only in ${graph_b} (${onlyB.length}): ${onlyB.slice(0, 15).join(', ')}\n\n` +
      `Overlap: ${(comparison.overlapRatio * 100).toFixed(1)}%`;

    return {
      structuredContent: { jsonrpc: "2.0", result: comparison },
      content: [{ type: "text" as const, text }],
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
          const a = nodes[e.source]?.label, b = nodes[e.target]?.label;
          if (a && b) {
            const key = `${a}-${b}`;
            if (!seen.has(key)) { seen.add(key); lines.push(`  ${a.replace(/\s/g,'_')} --> ${b.replace(/\s/g,'_')}`); }
          }
        });
        output = lines.join('\n');
        break;
      }
      case "csv": {
        const lines = ['source,target,weight,source_cluster,target_cluster'];
        edges.forEach((e: any) => {
          const a = nodes[e.source], b = nodes[e.target];
          if (a && b) lines.push(`"${a.label}","${b.label}",${e.weight},${a.community},${b.community}`);
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
  // list-graphs: list in-memory analyzed graphs
  // ══════════════════════════════════════════════════════════════════════════
  registerAppTool(server, "list-graphs", {
    description: "List all graphs analyzed in this session. Graphs are stored in memory and persist across tool calls within the same MCP session.",
    inputSchema: {},
    _meta: { ui: { resourceUri: VIEW_URI } },
  }, async () => {
    const graphs = [...graphStore.values()].map(g => ({
      name: g.name,
      nodeCount: g.result?.nodeCount ?? 0,
      edgeCount: g.result?.edgeCount ?? 0,
      clusterCount: g.result?.clusterCount ?? 0,
      createdAt: g.createdAt,
    }));

    const text = graphs.length === 0
      ? "No graphs in this session. Use analyze-text to create one."
      : `Graphs in session (${graphs.length}):\n` +
        graphs.map((g, i) => `  ${i+1}. ${g.name} (${g.nodeCount} nodes, ${g.clusterCount} clusters, ${g.createdAt})`).join("\n");

    return {
      structuredContent: { jsonrpc: "2.0", result: { graphs, count: graphs.length } },
      content: [{ type: "text" as const, text }],
    };
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

    // Combine the original text with the new text
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

      // Reparse (same logic as analyze-text)
      const topClusters = (attr.top_clusters || []).map((c: any) => ({
        id: parseInt(c.community ?? 0),
        words: c.nodes?.map((n: any) => n.nodeName) || [],
        numberRatio: c.numberRatio, bcRatio: c.bcRatio,
      }));
      const rawGaps = attr.gaps || [];
      const gaps = rawGaps.map((gap: any) => {
        const fromNodes = (gap.from?.nodes || []).sort((a: any, b: any) => (b.bc || 0) - (a.bc || 0));
        const toNodes = (gap.to?.nodes || []).sort((a: any, b: any) => (b.bc || 0) - (a.bc || 0));
        return { source: fromNodes[0]?.nodeName || '?', target: toNodes[0]?.nodeName || '?',
          sourceCluster: parseInt(gap.from?.community ?? 0), targetCluster: parseInt(gap.to?.community ?? 0),
          sourceWords: fromNodes.map((n: any) => n.nodeName), targetWords: toNodes.map((n: any) => n.nodeName),
          distance: gap.distance, weightedDistance: gap.distanceWeighedBySize };
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
