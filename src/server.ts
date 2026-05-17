import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerGraphTools } from "./tools/graph.js";
import { registerAnalysisTools } from "./tools/analysis.js";
import { registerSearchTools } from "./tools/search.js";
import { registerGraphResource } from "./resources/graph-ui.js";

const server = new McpServer({
  name: "infranodus-mcp-app",
  version: "0.1.0",
});

registerGraphTools(server);
registerAnalysisTools(server);
registerSearchTools(server);
registerGraphResource(server);

const transport = new StdioServerTransport();
await server.connect(transport);
