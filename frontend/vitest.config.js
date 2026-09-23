import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.js";

// Component and controller tests run in jsdom against a stubbed media element (jsdom has no media playback).
// `.test.js` files are the plain Node tests (npm run test:unit); Vitest runs only `.spec`.
export default mergeConfig(viteConfig, defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.spec.{js,jsx}"],
    restoreMocks: true,
  },
}));
