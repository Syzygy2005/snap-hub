import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    environment: "node",
    // Set TEST_DATABASE_URL to run the same tests through postgres.js against a real server.
    env: { PGLITE_DIR: "memory://", DATABASE_URL: process.env.TEST_DATABASE_URL ?? "" },
    testTimeout: 30_000,
  },
});
