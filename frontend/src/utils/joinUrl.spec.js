import { describe, expect, it } from "vitest";
import { joinPath, joinUrl } from "./joinUrl.js";

describe("joinUrl", () => {
  it("builds the public join route, the one AppRoot serves JoinScreen on", () => {
    expect(joinPath("al-noor")).toBe("/join/al-noor");
    expect(joinUrl("al-noor", "https://teach.example")).toBe("https://teach.example/join/al-noor");
  });

  it("never produces a double slash, whatever slashes the slug or origin carry", () => {
    for (const slug of ["/arabic-g1", "//arabic-g1", "arabic-g1/", " /arabic-g1/ "]) {
      expect(joinPath(slug)).toBe("/join/arabic-g1");
    }
    expect(joinUrl("/arabic-g1", "https://teach.example/")).toBe("https://teach.example/join/arabic-g1");
    expect(joinUrl("arabic-g1", "https://teach.example").replace("https://", "")).not.toContain("//");
  });

  it("defaults to the current origin", () => {
    expect(joinUrl("al-noor")).toBe(`${window.location.origin}/join/al-noor`);
  });
});
