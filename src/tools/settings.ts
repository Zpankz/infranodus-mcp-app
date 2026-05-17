import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getUiMode, setUiMode, type UiMode } from "../shared.js";

export function registerSettingsTools(server: McpServer) {
  server.tool(
    "set_ui_mode",
    'Switch the graph viewer UI between "sigma" (Sigma.js + ForceAtlas2 — lightweight, fast, sidebar with stats) and "canvas" (custom canvas engine with Topology/Atlas visual directions, glow halos, glassmorphism panels). Default is sigma. The change takes effect on the next tool call that returns a graph.',
    {
      mode: z.enum(["sigma", "canvas"]).describe(
        'UI mode: "sigma" = Sigma.js force-directed graph with sidebar clusters/gaps, "canvas" = custom canvas engine with Topology/Atlas directions'
      ),
    },
    async ({ mode }) => {
      const prev = getUiMode();
      setUiMode(mode as UiMode);
      return {
        content: [{
          type: "text" as const,
          text: prev === mode
            ? `UI mode is already "${mode}".`
            : `UI mode switched from "${prev}" to "${mode}". Next graph visualization will use the ${mode === "sigma" ? "Sigma.js" : "Canvas"} renderer.`,
        }],
      };
    }
  );

  server.tool(
    "get_ui_mode",
    "Get the current graph viewer UI mode (sigma or canvas).",
    {},
    async () => {
      const mode = getUiMode();
      const desc = mode === "sigma"
        ? "Sigma.js + ForceAtlas2 with sidebar stats, cluster list, and gap highlighting"
        : "Custom canvas engine with Topology/Atlas visual directions, glow halos, and glassmorphism";
      return {
        content: [{
          type: "text" as const,
          text: `Current UI mode: **${mode}**\n\n${desc}`,
        }],
      };
    }
  );
}
