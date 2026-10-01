import { defineConfig } from "@playwright/test";

// Entry-screen audit (e2e/entry): the built frontend with every API call stubbed — no backend,
// no database. Run with `npm run test:entry`.
const PORT = 4179;

export default defineConfig({
  testDir: "./e2e/entry",
  testMatch: "**/*.spec.js",
  timeout: 60_000,
  fullyParallel: true,
  reporter: [["list"]],
  outputDir: "./e2e/.output/entry-results",
  use: { baseURL: `http://localhost:${PORT}`, headless: true },
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
