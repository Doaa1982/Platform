import { describe, expect, it } from "vitest";
import { aiAccess, aiErrorKind } from "./aiAccessStore.js";

const sub = (profiles, credits = 200, licenseStatus = "Active") => ({
  licenseStatus,
  aiCreditsRemaining: credits,
  entitlements: Object.entries(profiles).map(([d, v]) => ({ key: `profile:${d}`, domain: d, value: v })),
});
const FREE = { Learning: "Professional", Assessment: "Foundation", Analytics: "Foundation", Branding: "Foundation" };
const ESSENTIAL = { Learning: "Foundation", Assessment: "Foundation", Analytics: "Foundation", Branding: "Foundation" };
const PRO = { Learning: "Professional", Assessment: "Professional", Analytics: "Professional", Branding: "Professional" };

describe("aiAccess", () => {
  it("opens Learning and Branding AI on Free and Essential while there are credits", () => {
    for (const plan of [FREE, ESSENTIAL]) {
      expect(aiAccess(sub(plan), "Branding")).toBe("allowed");
      expect(aiAccess(sub(plan), "Learning")).toBe("allowed");
    }
  });

  it("keeps Assessment AI to plans that include it", () => {
    expect(aiAccess(sub(FREE), "Assessment")).toBe("plan");
    expect(aiAccess(sub(ESSENTIAL), "Assessment")).toBe("plan");
    expect(aiAccess(sub(PRO), "Assessment")).toBe("allowed");
  });

  it("says 'credits' when the plan allows it but the balance is empty, 'plan' when the plan doesn't", () => {
    expect(aiAccess(sub(FREE, 0), "Branding")).toBe("credits");
    expect(aiAccess(sub(FREE, 0), "Assessment")).toBe("plan");   // buying credits wouldn't help
  });

  it("pauses everything on an inactive licence, and blocks nothing it can't read", () => {
    expect(aiAccess(sub(PRO, 500, "Restricted"), "Learning")).toBe("inactive");
    expect(aiAccess(null, "Learning")).toBe("plan");
    expect(aiAccess(undefined, "Learning")).toBe("unknown");
  });
});

describe("aiErrorKind", () => {
  it("maps API failures to what the teacher can do about them", () => {
    expect(aiErrorKind({ status: 402, creditsExhausted: true })).toBe("credits");
    expect(aiErrorKind({ status: 403 })).toBe("plan");
    expect(aiErrorKind({ status: 409 })).toBe("failed");
    expect(aiErrorKind({ status: 0 })).toBe("failed");
  });
});
