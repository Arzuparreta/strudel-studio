import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Single webaudio/soundMap: @strudel/webaudio → re-export from @strudel/web so soundfonts and REPL share one soundMap.
  resolve: {
    alias: {
      "@strudel/webaudio": path.resolve(__dirname, "src/strudel-webaudio-from-web.ts"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules") && id.includes("@strudel")) {
            return "strudel";
          }
        },
      },
    },
  },
});
