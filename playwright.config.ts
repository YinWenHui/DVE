import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev:local",
    url: "http://localhost:3000/login",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { AUTH_MODE: "mock", DATA_MODE: "mock" },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
