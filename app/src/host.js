// ============================================================
// window.mcp — host channel wrapper for the InfraNodus MCP App
// Implements the subset of the apps/2026-01-26 contract this app needs.
// Falls back to a local mock when running outside an MCP host (e.g.
// during preview / dev) so the same bundle works in both contexts.
// ============================================================

(function () {
  "use strict";

  // ── Detection ────────────────────────────────────────────────
  // The host injects `window.__mcpHost` before our scripts run.
  // If it's missing we're in standalone mode (preview, tests).
  const host = typeof window !== "undefined" ? window.__mcpHost : null;
  const standalone = !host;

  // ── Event bus ─────────────────────────────────────────────────
  const listeners = new Map();
  function on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
    return () => listeners.get(event)?.delete(fn);
  }
  function emit(event, payload) {
    listeners.get(event)?.forEach((fn) => {
      try { fn(payload); } catch (e) { console.error("[mcp]", event, e); }
    });
  }

  // ── Standalone mock context (preview-only) ───────────────────
  const mockContext = {
    resourceUri: location.hash.replace(/^#/, "") || "graph://demo",
    theme: matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark",
    host: { name: "preview", version: "0.0.0" },
    safeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 },
    displayMode: "fullscreen",
  };

  // ── Public API ────────────────────────────────────────────────
  const mcp = {
    /** Async context fetch — returns the host's snapshot. */
    async context() {
      if (standalone) return mockContext;
      return host.context();
    },

    /** Subscribe to lifecycle/host events.
     *  Events: "contextchanged" | "toolresult" | "toolinput" | "visibility" */
    on,

    /** Invoke a tool on the connected MCP server. */
    async callTool(name, args) {
      if (standalone) {
        console.info("[mcp.callTool mock]", name, args);
        return { ok: true, mock: true, name, args };
      }
      return host.callTool(name, args);
    },

    /** Suggest a follow-up prompt to the host LLM. */
    suggestPrompt(text) {
      if (standalone) {
        console.info("[mcp.suggestPrompt mock]", text);
        return;
      }
      host.suggestPrompt(text);
    },

    /** Open another resource (deep-link into another surface). */
    openResource(uri) {
      if (standalone) {
        location.hash = uri;
        mockContext.resourceUri = uri;
        emit("contextchanged", mockContext);
        return;
      }
      host.openResource(uri);
    },

    /** True when no real host is wired up (preview mode). */
    standalone,
  };

  // ── Wire host → bus when present ─────────────────────────────
  if (host) {
    if (host.onContextChanged) host.onContextChanged((ctx) => emit("contextchanged", ctx));
    if (host.onToolResult)     host.onToolResult((r) => emit("toolresult", r));
    if (host.onToolInput)      host.onToolInput((i) => emit("toolinput", i));
    if (host.onVisibility)     host.onVisibility((v) => emit("visibility", v));
  } else {
    // Standalone: react to hash changes so the preview routes.
    window.addEventListener("hashchange", () => {
      mockContext.resourceUri = location.hash.replace(/^#/, "") || "graph://demo";
      emit("contextchanged", mockContext);
    });
  }

  // ── Expose ───────────────────────────────────────────────────
  window.mcp = mcp;
})();
