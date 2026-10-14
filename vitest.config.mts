import { configDefaults, defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    exclude: [...configDefaults.exclude, "e2e/**"],
    environment: "node",
    // Set TEST_DATABASE_URL to run the same tests through postgres.js against a real server.
    env: { PGLITE_DIR: "memory://", DATABASE_URL: process.env.TEST_DATABASE_URL ?? "" },
    testTimeout: 30_000,
    // Hooks get the same budget. Most files make their first database call in a beforeEach or
    // beforeAll, and that call boots the worker's PGlite and applies the schema: about 2.7s on an
    // idle machine and 8 to 9.5s with three suites running at once, against vitest's default 10s
    // hook limit. Under load 18 files failed with "Hook timed out in 10000ms" and their tests
    // were reported as skipped, which is the unexplained "failed files, extra skips" seen before.
    hookTimeout: 30_000,
  },
});
