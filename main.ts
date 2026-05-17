import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import cors from "cors";
import { createServer } from "./src/server.js";

const port = parseInt(process.env.PORT ?? "8000", 10);

async function main() {
  // Stdio mode for Claude Desktop
  if (process.argv.includes("--stdio")) {
    const server = createServer();
    await server.connect(new StdioServerTransport());
    return;
  }

  // HTTP mode for web deployment
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.all("/mcp", async (req, res) => {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  app.listen(port, "0.0.0.0", () => {
    console.log(`MCP server listening on http://0.0.0.0:${port}/mcp`);
  });
  process.on("SIGINT", () => process.exit(0));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
