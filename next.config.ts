import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships WASM + data files that must be loaded from node_modules, not bundled.
  serverExternalPackages: ["@electric-sql/pglite"],
  // The download route reads the tracker script off disk, which file tracing can't infer.
  outputFileTracingIncludes: {
    "/api/tracker/download": ["./public/tracker/snaphub-tracker.ps1"],
  },
};

export default nextConfig;
