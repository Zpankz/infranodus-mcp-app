const API_BASE = "https://infranodus.com/api/v1";

function getApiToken(): string {
  const token = process.env.INFRANODUS_API_TOKEN;
  if (!token) {
    throw new Error(
      "INFRANODUS_API_TOKEN not set. Get one from https://infranodus.com/api-access"
    );
  }
  return token;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function callInfranodusApi(
  endpoint: string,
  params: Record<string, unknown>
): Promise<any> {
  const token = getApiToken();

  const response = await fetch(`${API_BASE}/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `InfraNodus API error (${response.status}): ${errorText.slice(0, 200)}`
    );
  }

  return response.json();
}

interface GraphNode {
  key: string;
  degree?: number;
  bc?: number;
  community?: number;
}

interface GraphData {
  entriesAndGraphOfContext?: {
    graph?: {
      graphologyGraph?: {
        nodes?: GraphNode[];
        edges?: Array<{ source: string; target: string; weight?: number }>;
        attributes?: {
          modularity?: number;
          top_nodes?: string[];
          top_clusters?: Array<{ label: string; nodes: string[] }>;
          gaps?: Array<{ cluster1: string; cluster2: string }>;
          diversity_stats?: { giniIndex?: number; shannonEntropy?: number };
        };
      };
    };
    statements?: Array<{ text: string }>;
    graphSummary?: string;
    extendedGraphSummary?: string;
  };
  [key: string]: unknown;
}

export function formatGraphSummary(data: GraphData): string {
  const ctx = data.entriesAndGraphOfContext;
  if (!ctx) return "Graph data unavailable.";

  const graph = ctx.graph?.graphologyGraph;
  if (!graph) return ctx.graphSummary || "Graph generated.";

  const nodes = graph.nodes || [];
  const edges = graph.edges || [];
  const attrs = graph.attributes || {};

  const lines: string[] = [
    `## Knowledge Graph`,
    `- **Nodes**: ${nodes.length} concepts`,
    `- **Edges**: ${edges.length} connections`,
  ];

  if (attrs.modularity !== undefined) {
    lines.push(`- **Modularity**: ${attrs.modularity.toFixed(3)}`);
  }

  if (attrs.top_nodes?.length) {
    lines.push(`- **Top concepts**: ${attrs.top_nodes.slice(0, 8).join(", ")}`);
  }

  if (attrs.top_clusters?.length) {
    lines.push(`\n### Topic Clusters`);
    for (const cluster of attrs.top_clusters.slice(0, 5)) {
      lines.push(
        `- **${cluster.label}**: ${cluster.nodes.slice(0, 5).join(", ")}`
      );
    }
  }

  if (attrs.gaps?.length) {
    lines.push(`\n### Structural Gaps (${attrs.gaps.length})`);
    for (const gap of attrs.gaps.slice(0, 3)) {
      lines.push(`- ${gap.cluster1} ↔ ${gap.cluster2}`);
    }
  }

  if (attrs.diversity_stats) {
    const ds = attrs.diversity_stats;
    if (ds.giniIndex !== undefined) {
      lines.push(`\n### Diversity`);
      lines.push(`- Gini index: ${ds.giniIndex.toFixed(3)}`);
      if (ds.shannonEntropy !== undefined) {
        lines.push(`- Shannon entropy: ${ds.shannonEntropy.toFixed(3)}`);
      }
    }
  }

  if (ctx.graphSummary) {
    lines.push(`\n### Summary\n${ctx.graphSummary}`);
  }

  return lines.join("\n");
}
