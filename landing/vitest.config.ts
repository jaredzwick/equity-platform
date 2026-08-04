import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    globals: false,
    setupFiles: ["tests/unit/setup-env.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
      // Next.js's server-only marker throws when imported from a client
      // component. Under Node/vitest it's meaningless — stub it out.
      "server-only": path.resolve(__dirname, "./tests/unit/stubs/server-only.ts"),
    },
  },
});
