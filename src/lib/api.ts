/**
 * InfraNodus API client module
 */

export interface ApiConfig {
  apiKey: string;
  apiUrl: string;
}

export interface ParsedGraphData {
  contextName: string;
  graphNodes: Array<{ id: string; label: string; community: number; bc: number; degree: number }>;
  graphEdges: Array<{ source: number; target: number; weight: number }>;
  topClusters: Array<{ id: number; words: string[]; numberRatio: number; bcRatio: number }>;
  gaps: Array<{
    source: string; target: string;
    sourceCluster: number; targetCluster: number;
    sourceWords: string[]; targetWords: string[];
    distance: number; weightedDistance: number;
  }>;
  topNodes: string[];
  statements: Array<{ id: string; content: string; community: number }>;
  dotGraph: string;
  modularity: number;
  nodeCount: number;
  edgeCount: number;
  clusterCount: number;
  extendedGraphSummary: {
    mainTopics: any[];
    contentGaps: any[];
    conceptualGateways: any[];
    diversityStatistics: any;
    topicsToDevelop: any[];
  };
}

/** Get API configuration from environment variables */
export function getApiConfig(): ApiConfig {
  const apiKey = process.env.INFRANODUS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "INFRANODUS_API_KEY not set. Get one from https://infranodus.com/api-access"
    );
  }
  return { apiKey, apiUrl: process.env.INFRANODUS_API_URL || "https://infranodus.com" };
}

/** Call InfraNodus API */
export async function callApi(
  endpoint: string,
  body: Record<string, unknown>,
  queryParams?: string
): Promise<any> {
  const { apiKey, apiUrl } = getApiConfig();
  const url = `${apiUrl}/api/v1/${endpoint}${queryParams ? `?${queryParams}` : ""}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`InfraNodus API ${response.status}: ${text.slice(0, 300)}`);
  }
  return response.json();
}

/** Parse raw InfraNodus response into normalized graph data */
export function parseGraphData(data: any, contextName?: string): ParsedGraphData {
  const g = data?.entriesAndGraphOfContext?.graph?.graphologyGraph;
  const attr = g?.attributes || {};
  const rawNodes = g?.nodes || [];
  const rawEdges = g?.edges || [];

  // Extended graph summary lives at top level of response
  const extRaw = data?.extendedGraphSummary || {};

  // Parse clusters
  const topClusters = (attr.top_clusters || []).map((c: any) => ({
    id: parseInt(c.community ?? c.id ?? 0),
    words: c.nodes?.map((n: any) => n.nodeName) || [],
    numberRatio: c.numberRatio || 0,
    bcRatio: c.bcRatio || 0,
  }));

  // Parse gaps
  const gaps = (attr.gaps || []).map((gap: any) => {
    const fromComm = gap.from || gap.source || {};
    const toComm = gap.to || gap.target || {};
    const fromNodes = (fromComm.nodes || []).slice().sort((a: any, b: any) => (b.bc || 0) - (a.bc || 0));
    const toNodes = (toComm.nodes || []).slice().sort((a: any, b: any) => (b.bc || 0) - (a.bc || 0));
    return {
      source: fromNodes[0]?.nodeName || `community ${fromComm.community || '?'}`,
      target: toNodes[0]?.nodeName || `community ${toComm.community || '?'}`,
      sourceCluster: parseInt(fromComm.community ?? 0),
      targetCluster: parseInt(toComm.community ?? 0),
      sourceWords: fromNodes.map((n: any) => n.nodeName),
      targetWords: toNodes.map((n: any) => n.nodeName),
      distance: gap.distance || 0,
      weightedDistance: gap.distanceWeighedBySize || 0,
    };
  });

  // Parse nodes
  const graphNodes: ParsedGraphData["graphNodes"] = rawNodes.map((n: any) => ({
    id: n.key || n.id,
    label: n.key || n.attributes?.label || n.id,
    community: n.attributes?.community ?? n.attributes?.cluster ?? 0,
    bc: n.attributes?.betweenness ?? n.attributes?.bc ?? 0,
    degree: n.attributes?.degree ?? n.attributes?.size ?? 1,
  }));

  // Parse edges (map source/target keys to indices)
  const nodeIndex: Record<string, number> = {};
  graphNodes.forEach((n: any, i: number) => { nodeIndex[n.id] = i; });
  const graphEdges: ParsedGraphData["graphEdges"] = rawEdges
    .map((e: any) => ({
      source: nodeIndex[e.source],
      target: nodeIndex[e.target],
      weight: e.attributes?.weight ?? 1,
    }))
    .filter((e: any) => e.source != null && e.target != null);

  // Compute modularity
  let intra = 0;
  graphEdges.forEach((e: any) => {
    if (graphNodes[e.source]?.community === graphNodes[e.target]?.community) intra++;
  });
  const modularity = graphEdges.length > 0 ? +(intra / graphEdges.length).toFixed(3) : 0;

  // Statements
  const rawStatements = data?.entriesAndGraphOfContext?.statements || [];
  const statements = rawStatements.slice(0, 50).map((s: any) => ({
    id: s.id || s.eid || "",
    content: s.content || s.text || "",
    community: s.topStatementCommunity || 0,
  }));

  return {
    contextName: contextName || "MCP Analysis",
    graphNodes, graphEdges, topClusters, gaps,
    topNodes: (attr.top_nodes || []).slice(0, 30),
    statements, dotGraph: attr.dotGraph || "",
    modularity, nodeCount: graphNodes.length, edgeCount: graphEdges.length,
    clusterCount: topClusters.length,
    extendedGraphSummary: {
      mainTopics: extRaw.mainTopics || [],
      contentGaps: extRaw.contentGaps || [],
      conceptualGateways: extRaw.conceptualGateways || [],
      diversityStatistics: extRaw.diversityStatistics || {},
      topicsToDevelop: extRaw.topicsToDevelop || [],
    },
  };
}

/** Format parsed graph data into readable markdown text */
export function formatGraphSummary(parsed: ParsedGraphData): string {
  const lines: string[] = [
    `## Knowledge Graph: ${parsed.contextName}`,
    `- **Nodes**: ${parsed.nodeCount} concepts`,
    `- **Edges**: ${parsed.edgeCount} connections`,
    `- **Clusters**: ${parsed.clusterCount}`,
    `- **Modularity**: ${parsed.modularity}`,
  ];

  // Top nodes
  if (parsed.topNodes.length) {
    lines.push(`- **Top concepts**: ${parsed.topNodes.slice(0, 8).join(", ")}`);
  }

  // Clusters
  if (parsed.topClusters.length) {
    lines.push("", "### Topic Clusters");
    parsed.topClusters.forEach((c, i) => {
      lines.push(`  ${i + 1}. [${c.words.slice(0, 3).join(", ")}] (${c.words.length} nodes, ${(c.bcRatio * 100).toFixed(0)}% centrality)`);
    });
  }

  // Gaps
  if (parsed.gaps.length) {
    lines.push("", `### Structural Gaps (${parsed.gaps.length})`);
    parsed.gaps.slice(0, 5).forEach((g) => {
      lines.push(`  ${g.source} ↔ ${g.target} (clusters ${g.sourceCluster}↔${g.targetCluster}, dist: ${g.distance?.toFixed(0) || "?"})`);
    });
  }

  // Top node details
  const sorted = parsed.graphNodes.slice().sort((a, b) => b.bc - a.bc).slice(0, 10);
  if (sorted.length) {
    lines.push("", "### Top Nodes by Centrality");
    sorted.forEach((n) => {
      lines.push(`  ${n.label} (bc: ${n.bc.toFixed(3)}, deg: ${n.degree}, cluster: ${n.community})`);
    });
  }

  // Extended summary
  const ext = parsed.extendedGraphSummary;
  if (ext.mainTopics.length) {
    const topics = ext.mainTopics.map((t: any) => typeof t === "string" ? t : t.name || t.topic || JSON.stringify(t));
    lines.push("", `**Main topics**: ${topics.slice(0, 10).join(", ")}`);
  }
  if (ext.contentGaps.length) {
    const cg = ext.contentGaps.map((g: any) => typeof g === "string" ? g : g.name || g.gap || JSON.stringify(g));
    lines.push(`**Content gaps**: ${cg.slice(0, 5).join(", ")}`);
  }
  if (ext.conceptualGateways.length) {
    const gw = ext.conceptualGateways.map((g: any) => typeof g === "string" ? g : g.name || JSON.stringify(g));
    lines.push(`**Conceptual gateways**: ${gw.slice(0, 5).join(", ")}`);
  }

  return lines.join("\n");
}
