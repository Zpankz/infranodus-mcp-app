// findBridges — concepts that connect two clusters.
// Results are scored by the requested centrality metric (default: betweenness).

export const findBridges = {
  name: "findBridges",
  description: "Find concepts that bridge two clusters, ranked by a centrality metric.",
  inputSchema: {
    type: "object",
    properties: {
      a:      { type: "string", description: "First cluster id or label." },
      b:      { type: "string", description: "Second cluster id or label." },
      metric: { type: "string", enum: ["betweenness", "pagerank", "degree"], default: "betweenness" },
      top:    { type: "integer", default: 6, minimum: 1, maximum: 50 },
      graphId:{ type: "string" },
    },
    required: ["a", "b"],
  },
  async run(args, { appResult }) {
    // TODO: upstream.findBridges(args). Stub fixture below.
    const bridges = [
      { id: "embedding", label: "embedding", cluster: "language model", score: 0.78 },
      { id: "ontology",  label: "ontology",  cluster: "knowledge graph", score: 0.71 },
      { id: "context",   label: "context",   cluster: "language model", score: 0.62 },
      { id: "vertex",    label: "vertex",    cluster: "knowledge graph", score: 0.54 },
      { id: "prompt",    label: "prompt",    cluster: "language model", score: 0.48 },
      { id: "concept",   label: "concept",   cluster: "knowledge graph", score: 0.41 },
    ].slice(0, args.top ?? 6);
    return appResult({
      surface: "canvas",
      graphId: args.graphId || "current",
      structuredContent: { bridges, score_range: [0.41, 0.78] },
    });
  },
};
