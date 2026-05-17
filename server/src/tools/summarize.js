// summarize — AI summary over a graph, cluster, or node.
// Renders into the Insights surface (when scope=graph|cluster) or
// inline as a tooltip payload (when scope=node).

export const summarize = {
  name: "summarize",
  description: "Generate an AI summary of a graph, cluster, or node.",
  inputSchema: {
    type: "object",
    properties: {
      graphId: { type: "string" },
      scope:   { type: "string", enum: ["graph", "cluster", "node"], default: "graph" },
      target:  { type: "string", description: "Cluster id or node id, when scope is cluster/node." },
      style:   { type: "string", enum: ["brief", "detailed"], default: "brief" },
    },
  },
  async run(args, { appResult }) {
    const summary = {
      graph:
        "The corpus organizes around three loose communities: knowledge representation, language modeling, and discourse. Most cross-cluster paths route through 'embedding' and 'ontology'.",
      cluster:
        "This cluster anchors the corpus. Its hub concepts — ontology, embedding — also act as bridges to the language-modeling community.",
      node:
        "Discussed in 14 contexts; degree 11; pagerank 0.92. Functions as a bridge concept.",
    }[args.scope || "graph"];

    return appResult({
      surface: args.scope === "node" ? null : "insights",
      graphId: args.graphId || "current",
      structuredContent: { summary, scope: args.scope || "graph", target: args.target },
    });
  },
};
