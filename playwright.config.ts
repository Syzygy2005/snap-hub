import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: "http://127.0.0.1:3101", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } },
  ],
  webServer: { command: "npx tsx e2e/server.ts", url: "http://127.0.0.1:3101", timeout: 120_000, reuseExistingServer: false },
});
