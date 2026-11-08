import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

config({ quiet: true });
const testDatabaseUrl = process.env.E2E_DATABASE_URL ?? process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) throw new Error("E2E requires an explicit local E2E_DATABASE_URL or TEST_DATABASE_URL.");
const database = new URL(testDatabaseUrl);
if (
  !["postgres:", "postgresql:"].includes(database.protocol) ||
  !["localhost", "127.0.0.1", "[::1]"].includes(database.hostname)
) {
  throw new Error("E2E requires a local PostgreSQL database.");
}

const port = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  workers: 1,
  timeout: 90_000,
  reporter: "list",
  outputDir: "./test-results",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}/login`,
    reuseExistingServer: false,
    env: {
      DATABASE_URL: testDatabaseUrl,
      BETTER_AUTH_URL: `http://127.0.0.1:${port}`,
      BETTER_AUTH_SECRET: "local-e2e-only-secret-not-for-production-123456789",
    },
    timeout: 120_000,
  },
});
