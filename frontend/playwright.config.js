import { defineConfig } from "@playwright/test";

// Run through `npm run test:e2e` (e2e/run.mjs), which starts an isolated stack and passes E2E_* settings in.
// Uses the installed Google Chrome by default: Playwright's bundled Chromium cannot play H.264, which lesson videos use.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.js",
  timeout: 240_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  outputDir: "./e2e/.output",
  use: {
    baseURL: process.env.E2E_BASE_URL,
    channel: process.env.E2E_BROWSER_CHANNEL ?? "chrome",
    headless: true,
    // --disable-quic: on some networks Chrome's first HTTP/3 connections to R2 stall for 10-20 s before falling back to TCP
    // (measured here: a bare <video> on a presigned URL, 12 loads — two stalled 10-16 s with default flags, none with
    // QUIC disabled). The player has its own stalled-load watchdog; the browser test disables QUIC so it is about the
    // refresh, not the network.
    launchOptions: { args: ["--autoplay-policy=no-user-gesture-required", "--disable-quic"] },
  },
});
