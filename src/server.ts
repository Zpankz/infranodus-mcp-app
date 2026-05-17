import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGraphTools } from "./tools/graph.js";
import { registerAnalysisTools } from "./tools/analysis.js";
import { registerSearchTools } from "./tools/search.js";
import { registerSettingsTools } from "./tools/settings.js";
import { registerPrompts } from "./prompts.js";
import { registerGraphResource } from "./resources/graph-ui.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "infranodus-mcp-app",
    version: "2.0.0",
  });

  registerGraphTools(server);
  registerAnalysisTools(server);
  registerSearchTools(server);
  registerSettingsTools(server);
  registerPrompts(server);
  registerGraphResource(server);

  return server;
}
