import { defineConfig } from "@playwright/test";

// Language / theme / accessibility audit of every screen: entry screens (e2e/entry, API stubbed)
// and in-app screens (e2e/app, API replayed from recordings). The built frontend only — no backend,
// no database. Run with `npm run test:audit`; re-record the in-app fixtures with `npm run audit:record`.
const PORT = 4179;

export default defineConfig({
  testDir: "./e2e",
  testMatch: ["entry/**/*.spec.js", "app/**/*.spec.js"],
  timeout: 60_000,
  fullyParallel: true,
  reporter: [["list"]],
  outputDir: "./e2e/.output/audit-results",
  use: { baseURL: `http://localhost:${PORT}`, headless: true },
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
