import { afterEach, describe, expect, it } from "vitest";
import { money } from "./format";

const setLang = (lang) => { document.documentElement.lang = lang; };

describe("money", () => {
  afterEach(() => setLang("en"));

  it("formats Egyptian pounds with E£ in English", () => {
    setLang("en");
    expect(money(699, "EGP")).toBe("E£699");
    expect(money(2499, "EGP")).toBe("E£2,499");
  });

  it("uses ج.م after the number in Arabic", () => {
    setLang("ar");
    expect(money(699, "EGP")).toBe("699 ج.م");
  });

  it("defaults to EGP and still handles USD", () => {
    setLang("en");
    expect(money(149)).toBe("E£149");
    expect(money(19, "USD")).toBe("$19");
  });
});
