import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getUiMode, setUiMode, type UiMode } from "../shared.js";

export function registerSettingsTools(server: McpServer) {
  server.tool(
    "set_ui_mode",
    'Switch the graph viewer UI between "sigma" (Sigma.js + ForceAtlas2), "canvas" (custom canvas engine with Topology/Atlas), or "3d" (3D force-directed graph with Three.js, 2D/3D toggle, bloom effects). Default is sigma.',
    {
      mode: z.enum(["sigma", "canvas", "3d"]).describe(
        'UI mode: "sigma" = Sigma.js force-directed, "canvas" = custom canvas with Topology/Atlas, "3d" = Three.js 3D force-graph with bloom effects and 2D/3D toggle'
      ),
    },
    async ({ mode }) => {
      const prev = getUiMode();
      setUiMode(mode as UiMode);
      const desc = mode === "sigma" ? "Sigma.js" : mode === "3d" ? "3D Force Graph" : "Canvas";
      return {
        content: [{
          type: "text" as const,
          text: prev === mode
            ? `UI mode is already "${mode}".`
            : `UI mode switched from "${prev}" to "${mode}". Next graph visualization will use the ${desc} renderer.`,
        }],
      };
    }
  );

  server.tool(
    "get_ui_mode",
    "Get the current graph viewer UI mode (sigma, canvas, or 3d).",
    {},
    async () => {
      const mode = getUiMode();
      const desc = mode === "sigma"
        ? "Sigma.js + ForceAtlas2 with sidebar stats, cluster list, and gap highlighting"
        : mode === "3d"
        ? "3D force-directed graph with Three.js, bloom effects, orbit controls, and 2D/3D dimension toggle"
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
