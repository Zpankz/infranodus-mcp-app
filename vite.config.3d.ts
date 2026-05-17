import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  root: "src/ui",
  build: {
    outDir: "../../dist/ui-3d",
    emptyOutDir: true,
    rollupOptions: {
      input: "src/ui/index-3d.html",
    },
  },
  plugins: [viteSingleFile()],
});
