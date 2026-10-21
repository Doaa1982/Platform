import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { campaignQuery, redactPath } from "./analytics.js";

describe("redactPath", () => {
  it("never lets a bearer token from a link reach analytics", () => {
    expect(redactPath("/invite/abc123SECRET")).toBe("/invite/:token");
    expect(redactPath("/apply/status/abc123SECRET")).toBe("/apply/status/:token");
    expect(redactPath("/join-requests/status/abc123SECRET")).toBe("/join-requests/status/:token");
    expect(redactPath("/reset-password/abc123SECRET/")).toBe("/reset-password/:token");
  });

  it("leaves ordinary routes as they are", () => {
    for (const p of ["/", "/apply", "/teach", "/learn", "/join/al-noor"]) expect(redactPath(p)).toBe(p);
    expect(redactPath("/teach/")).toBe("/teach");
    expect(redactPath("")).toBe("/");
  });
});

describe("campaignQuery", () => {
  it("keeps utm_* parameters and drops everything else", () => {
    expect(campaignQuery("?utm_source=facebook&token=x&utm_campaign=launch_oct26&email=a%40b.c"))
      .toBe("?utm_source=facebook&utm_campaign=launch_oct26");
    expect(campaignQuery("?foo=bar")).toBe("");
    expect(campaignQuery("")).toBe("");
  });
});

describe("with a measurement ID", () => {
  let analytics;
  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("VITE_GA_MEASUREMENT_ID", "G-TEST123");
    window.localStorage.clear();
    delete window.gtag;
    delete window.dataLayer;
    analytics = await import("./analytics.js");
    analytics.initAnalytics();
  });
  afterEach(() => { vi.unstubAllEnvs(); });

  const events = () => window.dataLayer.filter((a) => a[0] === "event").map((a) => [a[1], a[2]]);

  it("loads gtag once with automatic page views off", () => {
    analytics.initAnalytics();
    const config = window.dataLayer.filter((a) => a[0] === "config");
    expect(config).toHaveLength(1);
    expect(config[0][2]).toEqual({ send_page_view: false });
    expect(document.querySelectorAll('script[src*="googletagmanager.com/gtag/js?id=G-TEST123"]').length).toBe(1);
  });

  it("sends redacted page views", () => {
    analytics.trackPageView("/invite/SECRET", "?utm_source=whatsapp&token=SECRET");
    const [[name, params]] = events();
    expect(name).toBe("page_view");
    expect(params.page_path).toBe("/invite/:token");
    expect(params.page_location).toBe(`${window.location.origin}/invite/:token?utm_source=whatsapp`);
    expect(JSON.stringify(params)).not.toContain("SECRET");
  });

  it("sends first_lesson_published only once per workspace", () => {
    analytics.trackLessonPublished("al-noor");
    analytics.trackLessonPublished("al-noor");
    analytics.trackLessonPublished("math-for-all");
    expect(events().map(([n, p]) => `${n}:${p.workspace}`)).toEqual([
      "lesson_published:al-noor", "first_lesson_published:al-noor",
      "lesson_published:al-noor",
      "lesson_published:math-for-all", "first_lesson_published:math-for-all",
    ]);
  });

  it("names the funnel events GA expects", () => {
    analytics.trackTutorCta("hero");
    analytics.trackSignUp();
    expect(events()).toEqual([
      ["cta_click", { cta: "become_tutor", location: "hero" }],
      ["sign_up", { method: "tutor_application" }],
    ]);
  });
});

describe("without a measurement ID", () => {
  it("does nothing at all", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_GA_MEASUREMENT_ID", "");
    delete window.gtag;
    delete window.dataLayer;
    const analytics = await import("./analytics.js");
    analytics.initAnalytics();
    analytics.trackPageView("/");
    analytics.trackSignUp();
    expect(window.gtag).toBeUndefined();
    expect(window.dataLayer).toBeUndefined();
    vi.unstubAllEnvs();
  });
});
