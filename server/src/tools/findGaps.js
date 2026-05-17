// findGaps — pairs of clusters with low connectivity that could be bridged.
// Each gap returns a rationale sentence and a suggested bridge concept.

export const findGaps = {
  name: "findGaps",
  description: "Identify structural gaps in the graph — pairs of clusters with low connectivity and a suggested bridge concept.",
  inputSchema: {
    type: "object",
    properties: {
      graphId: { type: "string" },
      top:     { type: "integer", default: 9, minimum: 1, maximum: 50 },
    },
  },
  async run(args, { appResult }) {
    const gaps = [
      {
        a: "discourse", b: "network science",
        strength: 0.78,
        rationale: "No node connects rhetorical framing to centrality measures.",
        bridge: "narrative betweenness",
      },
      {
        a: "language model", b: "gaps",
        strength: 0.62,
        rationale: "LLM context windows discussed but never linked to the blind-spot cluster.",
        bridge: "attention coverage",
      },
      {
        a: "ontology", b: "discourse",
        strength: 0.41,
        rationale: "Structural concepts not yet narrativized.",
        bridge: null,
      },
    ].slice(0, args.top ?? 9);

    return appResult({
      surface: "insights",
      graphId: args.graphId || "current",
      structuredContent: { gaps },
    });
  },
};
