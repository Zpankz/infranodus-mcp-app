// analyzeText — turn raw text into a knowledge graph.
// Forwards to the upstream InfraNodus engine; the stub returns a fixture.
//
// Returns: graph payload + meta{surface:"canvas"} so the app opens the canvas.

export const analyzeText = {
  name: "analyzeText",
  description: "Build a knowledge graph from a blob of text. Concepts become nodes; co-occurrences become edges; communities surface as clusters.",
  inputSchema: {
    type: "object",
    properties: {
      text:     { type: "string", description: "Text to analyze." },
      language: { type: "string", description: "ISO 639-1 code; auto-detected if omitted." },
      name:     { type: "string", description: "Optional graph name." },
    },
    required: ["text"],
  },
  async run(args, { appResult }) {
    // TODO: replace with upstream.analyzeText(args)
    const graphId = args.name ? slug(args.name) : "current";
    return appResult({
      surface: "canvas",
      graphId,
      structuredContent: {
        graph: {
          id: graphId,
          nodes: [], edges: [], clusters: [],
          stats: { nodes: 142, edges: 318, clusters: 5, modularity: 0.42 },
        },
      },
    });
  },
};

function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
