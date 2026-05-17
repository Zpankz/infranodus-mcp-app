// ============================================================
// InfraNodus MCP App — production entry
// Routes between the 5 surfaces based on the host's resourceUri,
// chooses a visual direction (Topology/Atlas) based on displayMode,
// and exposes a small in-app Tweaks affordance (when permitted).
// ============================================================

const { useState, useEffect, useMemo } = React;

// ── URI router ───────────────────────────────────────────────
// graph://<id>            → "canvas"
// graph://<id>/query      → "query"
// graph://<id>/insights   → "insights"
// graphs://               → "resources"
// app://onboard | null    → "onboard"
function parseUri(uri) {
  if (!uri || uri === "app://onboard") return { surface: "onboard" };
  if (uri === "graphs://") return { surface: "resources" };
  const m = String(uri).match(/^graph:\/\/([^/]+)(?:\/(.+))?$/);
  if (!m) return { surface: "onboard" };
  const [, id, sub] = m;
  if (sub === "query") return { surface: "query", id };
  if (sub === "insights") return { surface: "insights", id };
  return { surface: "canvas", id };
}

// ── Default direction policy ─────────────────────────────────
// Atlas when there's room to breathe, Topology when embedded inline.
function defaultDirection(ctx) {
  if (ctx?.displayMode === "inline") return "topology";
  return "atlas";
}

function App() {
  const [ctx, setCtx] = useState(null);
  const [direction, setDirection] = useState("atlas");
  const [tweaks, setTweaks] = useState({
    density: "balanced",
    labels: "hubs",
    accent: "oklch(0.74 0.155 52)",
  });

  // Boot: pull context from host, subscribe to changes.
  useEffect(() => {
    let off = () => {};
    (async () => {
      const c = await window.mcp.context();
      setCtx(c);
      setDirection(defaultDirection(c));
      applyTheme(c.theme);
      off = window.mcp.on("contextchanged", (next) => {
        setCtx(next);
        applyTheme(next.theme);
      });
    })();
    return () => off();
  }, []);

  // Tool-result driven navigation: when a tool returns, route to the
  // surface its `meta.surface` declares (the server tells us where to
  // render — see SKILL-2 / server/src/tools/*).
  useEffect(() => {
    return window.mcp.on("toolresult", (r) => {
      const target = r?.meta?.surface;
      if (!target) return;
      // The result's structuredContent is read by individual surfaces
      // via context — here we just trigger the route.
      if (target === "canvas" || target === "query" || target === "insights" ||
          target === "resources" || target === "onboard") {
        // In a richer implementation we'd dispatch into a store; for now
        // we honor the surface mapping by mutating the parsed uri.
        const id = r?.meta?.graphId || (ctx && parseUri(ctx.resourceUri).id) || "current";
        const uri =
          target === "resources" ? "graphs://" :
          target === "onboard" ? "app://onboard" :
          `graph://${id}${target === "canvas" ? "" : "/" + target}`;
        window.mcp.openResource(uri);
      }
    });
  }, [ctx]);

  // Apply host theme tokens (light overrides; dark is the default).
  function applyTheme(scheme) {
    const root = document.documentElement;
    if (scheme === "light") {
      root.style.setProperty("--host-bg",       "oklch(0.985 0.003 80)");
      root.style.setProperty("--host-bg-2",     "oklch(0.965 0.004 80)");
      root.style.setProperty("--host-bg-3",     "oklch(0.94  0.005 80)");
      root.style.setProperty("--host-fg",       "oklch(0.18  0.01  250)");
      root.style.setProperty("--host-fg-2",     "oklch(0.36  0.008 250)");
      root.style.setProperty("--host-fg-3",     "oklch(0.55  0.008 250)");
      root.style.setProperty("--host-border",   "oklch(0.86  0.008 250)");
      root.style.setProperty("--host-border-2", "oklch(0.91  0.006 250)");
    } else {
      ["--host-bg","--host-bg-2","--host-bg-3","--host-fg","--host-fg-2","--host-fg-3","--host-border","--host-border-2"].forEach(p => root.style.removeProperty(p));
    }
  }

  // Apply accent live.
  useEffect(() => {
    document.documentElement.style.setProperty("--in-accent", tweaks.accent);
  }, [tweaks.accent]);

  // Honor safe-area insets if the host provides them.
  useEffect(() => {
    if (!ctx?.safeAreaInsets) return;
    const { top = 0, right = 0, bottom = 0, left = 0 } = ctx.safeAreaInsets;
    const r = document.documentElement.style;
    r.setProperty("padding-top",    top + "px");
    r.setProperty("padding-right",  right + "px");
    r.setProperty("padding-bottom", bottom + "px");
    r.setProperty("padding-left",   left + "px");
  }, [ctx?.safeAreaInsets]);

  const route = useMemo(() => parseUri(ctx?.resourceUri), [ctx?.resourceUri]);

  // Pick the screen component pair based on direction.
  const screens = direction === "topology"
    ? {
        canvas: TopologyCanvas, query: TopologyQuery, insights: TopologyInsights,
        resources: TopologyResources, onboard: TopologyOnboarding,
      }
    : {
        canvas: AtlasCanvas, query: AtlasQuery, insights: AtlasInsights,
        resources: AtlasResources, onboard: AtlasOnboarding,
      };

  if (!ctx) return null; // wait for first context

  const Surface = screens[route.surface] || screens.onboard;
  return <Surface tweaks={tweaks} ctx={ctx} />;
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
