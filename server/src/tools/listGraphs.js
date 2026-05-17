// listGraphs — index of every graph the user has access to.
// Renders into the Resource Browser surface.

export const listGraphs = {
  name: "listGraphs",
  description: "List the graphs available to the user.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Filter by name, tag, or concept." },
      limit: { type: "integer", default: 50, minimum: 1, maximum: 500 },
    },
  },
  async run(args, { appResult }) {
    const graphs = [
      { id: "research-notes-2026",   name: "research-notes-2026",   nodes: 142, clusters: 5,  updated: "2h ago" },
      { id: "podcast-transcripts-q1", name: "podcast-transcripts/q1", nodes: 891, clusters: 12, updated: "yesterday" },
      { id: "claude-sessions",       name: "chat://claude-sessions", nodes: 56,  clusters: 3,  updated: "3d ago" },
      { id: "manuscript-draft-v4",   name: "manuscript-draft-v4",   nodes: 612, clusters: 8,  updated: "last week" },
      { id: "competitor-scan",       name: "competitor-scan",       nodes: 208, clusters: 6,  updated: "aug 04" },
      { id: "customer-interviews",   name: "customer-interviews",   nodes: 744, clusters: 11, updated: "aug 02" },
    ];
    const filtered = args.query
      ? graphs.filter((g) => g.name.toLowerCase().includes(args.query.toLowerCase()))
      : graphs;
    return appResult({
      surface: "resources",
      structuredContent: { graphs: filtered.slice(0, args.limit ?? 50) },
    });
  },
};
