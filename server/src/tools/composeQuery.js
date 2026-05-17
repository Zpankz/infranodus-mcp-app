// composeQuery — compile a natural-language question into a plan of
// MCP tool calls. Does NOT execute. The app shows the plan in the
// Query Compiler surface; the user reviews, then dispatches.
//
// In production this calls a small LLM (haiku-class) with a system
// prompt that enumerates the available tools and their schemas.

export const composeQuery = {
  name: "composeQuery",
  description: "Compile a natural-language question into a plan of MCP tool calls (does not execute).",
  inputSchema: {
    type: "object",
    properties: {
      question: { type: "string", description: "User's question in plain English." },
      graphId:  { type: "string", description: "Graph context, if any." },
    },
    required: ["question"],
  },
  async run(args, { appResult }) {
    // TODO: replace with haiku call. Stub returns a canned plan that
    // matches the design.md §6.1 example exactly.
    const plan = [
      { tool: "findBridges",       args: { a: "knowledge graphs", b: "language models", metric: "betweenness", top: 6 } },
      { tool: "expandConcept",     args: { id: "embedding", hop: 2 } },
      { tool: "summarize",         args: { cluster: "discourse" } },
    ];
    return appResult({
      surface: "query",
      graphId: args.graphId,
      structuredContent: {
        plan,
        speak: "Showing top bridges and expanding embedding…",
        question: args.question,
      },
    });
  },
};
