// Shared state and constants for InfraNodus MCP server

export const VIEW_URI = "ui://infranodus/graph-viewer";

// ── UI mode toggle ────────────────────────────────────────────────────────
export type UiMode = "sigma" | "canvas";

let _uiMode: UiMode = (process.env.UI_MODE === "canvas" ? "canvas" : "sigma");

export function getUiMode(): UiMode { return _uiMode; }
export function setUiMode(mode: UiMode) { _uiMode = mode; }

export interface StoredGraph {
  name: string;
  text: string;
  result: any;
  dotGraph: string;
  topNodesText: string;
  createdAt: string;
}

export const graphStore = new Map<string, StoredGraph>();
const MAX_GRAPHS = 20;

export function storeGraph(name: string, text: string, result: any) {
  if (graphStore.size >= MAX_GRAPHS) {
    const oldest = graphStore.keys().next().value;
    if (oldest) graphStore.delete(oldest);
  }
  const topNodesText = (result.topClusters || []).map((c: any, i: number) =>
    `Cluster ${i} (${c.words?.[0] || '?'}): ${c.words?.join(', ') || '(empty)'}`
  ).join('\n');
  graphStore.set(name, {
    name, text, result, dotGraph: result.dotGraph || '', topNodesText,
    createdAt: new Date().toISOString(),
  });
}

export function getLatestGraph(): StoredGraph | undefined {
  let latest: StoredGraph | undefined;
  for (const g of graphStore.values()) latest = g;
  return latest;
}
