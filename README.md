# InfraNodus MCP App

Knowledge graph visualization, AI advice, and semantic search — rendered inline in Claude Desktop and other MCP-enabled hosts.

Built with the MCP Apps SDK (`@modelcontextprotocol/ext-apps`).

## Tools

| Tool | Description |
|---|---|
| `analyze-text` | Generate a knowledge graph from text — shows topical clusters, structural gaps, key concepts |
| `graph-ai-advice` | Get AI-generated summaries, gap analysis, research questions about a graph |
| `semantic-search` | Find semantically related statements within a text corpus |

## Quick Start (Local)

```bash
npm install
INFRANODUS_API_KEY=your_key npm run dev
```

Open `http://localhost:3001/mcp` — this is the MCP endpoint.

## Deploy to exe.xyz

```bash
# 1. Create VM
ssh exe.dev new --name infranodus-mcp

# 2. Copy files
scp -r . infranodus-mcp.exe.xyz:~/app/

# 3. SSH in and setup
ssh infranodus-mcp.exe.xyz
cd ~/app && bash setup.sh

# 4. Expose the MCP endpoint
# From exe.dev REPL:
ssh exe.dev share port infranodus-mcp 3001
ssh exe.dev share set-public infranodus-mcp
```

The MCP server is now at `https://infranodus-mcp.exe.xyz/mcp`

## Connect to Claude Desktop

Add to your MCP client config:

```json
{
  "mcpServers": {
    "infranodus": {
      "url": "https://infranodus-mcp.exe.xyz/mcp"
    }
  }
}
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `INFRANODUS_API_KEY` | Yes | Your InfraNodus API key |
| `INFRANODUS_API_URL` | No | API URL (default: `https://infranodus.com`) |
| `PORT` | No | Server port (default: `3001`) |

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌───────────────┐
│  Claude Desktop  │◄───►│  MCP Server      │◄───►│  InfraNodus   │
│  (Host)          │     │  (Express+MCP)   │     │  API          │
│                  │     │                  │     │               │
│  ┌────────────┐  │     │  Tools:          │     │  /graphAnd... │
│  │ View       │  │     │  - analyze-text  │     │  /aiAdvice    │
│  │ (iframe)   │◄─┼─────│  - ai-advice     │     │  /aiSearch    │
│  │            │  │     │  - search        │     │               │
│  └────────────┘  │     │                  │     │               │
└─────────────────┘     │  Resource:       │     │               │
                        │  - view.html     │     │               │
                        └──────────────────┘     └───────────────┘
```

## License

MIT
