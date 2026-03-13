import { defineConfig } from "vitest/config";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "__tests__/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@strudel-studio/pattern-ast": path.resolve(
        __dirname,
        "../pattern-ast/src/index.ts",
      ),
    },
  },
});

