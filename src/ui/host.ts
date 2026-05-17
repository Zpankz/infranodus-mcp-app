// ============================================================
// MCP Host Channel — apps/2026-01-26 spec compliant
// Bridges window.__mcpHost, postMessage JSON-RPC, and standalone mock.
// Ported from mcp-app-v3 branch host.js, upgraded to TypeScript.
// ============================================================

export interface McpContext {
  resourceUri: string;
  theme: "dark" | "light";
  host: { name: string; version: string };
  safeAreaInsets: { top: number; right: number; bottom: number; left: number };
  displayMode: "inline" | "fullscreen";
  styles?: Record<string, string>;
}

export interface ToolResult {
  content?: any;
  text?: string;
  structuredContent?: any;
  meta?: { surface?: string; graphId?: string };
}

type McpEvent = "toolresult" | "contextchanged" | "graphdata";
type McpListener = (payload: any) => void;

// ── Detection ───────────────────────────────────────────────
const host = typeof window !== "undefined" ? (window as any).__mcpHost : null;
const isIframe = typeof window !== "undefined" && window.location.origin === "null";
const standalone = !host && !isIframe;

// ── Event bus ───────────────────────────────────────────────
const listeners = new Map<McpEvent, Set<McpListener>>();

function on(event: McpEvent, fn: McpListener): () => void {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event)!.add(fn);
  return () => { listeners.get(event)?.delete(fn); };
}

function emit(event: McpEvent, payload: any) {
  listeners.get(event)?.forEach((fn) => {
    try { fn(payload); } catch (e) { console.error("[mcp]", event, e); }
  });
}

// ── Mock context (standalone/preview) ───────────────────────
const mockContext: McpContext = {
  resourceUri: typeof location !== "undefined"
    ? (location.hash.replace(/^#/, "") || "graph://demo")
    : "graph://demo",
  theme: typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: light)").matches
    ? "light" : "dark",
  host: { name: "preview", version: "0.0.0" },
  safeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 },
  displayMode: "fullscreen",
};

// ── Public API ──────────────────────────────────────────────
export const mcp = {
  async context(): Promise<McpContext> {
    if (host) return host.context();
    return mockContext;
  },

  on(event: McpEvent, fn: McpListener): () => void {
    if (host) return host.on(event, fn);
    return on(event, fn);
  },

  async callTool(name: string, args: Record<string, any> = {}): Promise<ToolResult> {
    if (host) return host.callTool(name, args);
    if (isIframe) {
      window.parent.postMessage(
        { jsonrpc: "2.0", method: "tools/call", params: { name, arguments: args }, id: Date.now() },
        "*"
      );
      return { content: [{ type: "text", text: "(pending)" }] };
    }
    console.info("[mcp mock] callTool", name, args);
    return { content: [{ type: "text", text: "(mock)" }] };
  },

  async readResource(uri: string): Promise<any> {
    if (host) return host.readResource(uri);
    console.info("[mcp mock] readResource", uri);
    return null;
  },

  openResource(uri: string) {
    if (host) return host.openResource(uri);
    if (standalone) {
      location.hash = uri;
      emit("contextchanged", { ...mockContext, resourceUri: uri });
      return;
    }
    window.parent.postMessage(
      { jsonrpc: "2.0", method: "resources/open", params: { uri } },
      "*"
    );
  },

  suggestPrompt(text: string) {
    if (host) return host.suggestPrompt(text);
    console.info("[mcp mock] suggestPrompt:", text);
  },

  get standalone() { return standalone; },
  get isIframe() { return isIframe; },
};

// ── postMessage bridge (iframe mode) ────────────────────────
// Converts incoming JSON-RPC and simple messages to mcp events.
if (typeof window !== "undefined") {
  window.addEventListener("message", (event) => {
    const msg = event.data;
    if (!msg) return;

    // JSON-RPC 2.0 from MCP host
    if (msg.jsonrpc === "2.0") {
      if (msg.method === "notifications/tool_result") {
        try {
          const content = msg.params?.content;
          const text = typeof content === "string" ? content : content?.text;
          if (text) emit("toolresult", JSON.parse(text));
        } catch (e) {
          console.error("Failed to parse tool result:", e);
        }
      }
      if (msg.method === "notifications/host_context_changed") {
        emit("contextchanged", msg.params);
      }
    }

    // Simple message format (direct data pass)
    if (msg.type === "tool_result" && msg.content) {
      try {
        const data = typeof msg.content === "string" ? JSON.parse(msg.content) : msg.content;
        emit("toolresult", data);
      } catch (e) {
        console.error("Failed to parse direct tool result:", e);
      }
    }

    // graphData message from parent (test harness)
    if (msg.type === "graphData" && msg.data) {
      emit("graphdata", msg.data);
      emit("toolresult", msg.data);
    }
  });

  // Signal ready to host when in iframe
  if (isIframe) {
    window.parent.postMessage(
      { jsonrpc: "2.0", method: "notifications/ready", params: {} },
      "*"
    );
  }

  // Standalone: wire hash changes and theme changes
  if (standalone) {
    window.addEventListener("hashchange", () => {
      mockContext.resourceUri = location.hash.replace(/^#/, "") || "graph://demo";
      emit("contextchanged", { ...mockContext });
    });
    if (typeof matchMedia !== "undefined") {
      matchMedia("(prefers-color-scheme: light)").addEventListener("change", (e) => {
        mockContext.theme = e.matches ? "light" : "dark";
        emit("contextchanged", { ...mockContext });
      });
    }
  }
}

// Expose globally
if (typeof window !== "undefined") {
  (window as any).mcp = mcp;
}
