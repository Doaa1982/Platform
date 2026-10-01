import { describe, expect, it } from "vitest";
import { translations } from "./translations.js";

const flatten = (node, prefix = "") =>
  Object.entries(node).flatMap(([k, v]) => (typeof v === "object" && v !== null ? flatten(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]]));

const en = new Map(flatten(translations.en));
const ar = new Map(flatten(translations.ar));
const placeholders = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("translations", () => {
  it("every English key exists in Arabic", () => {
    expect([...en.keys()].filter((k) => !ar.has(k))).toEqual([]);
  });

  it("every Arabic key exists in English", () => {
    expect([...ar.keys()].filter((k) => !en.has(k))).toEqual([]);
  });

  it("every value is a non-empty string", () => {
    const bad = [...en, ...ar].filter(([, v]) => typeof v !== "string" || v.trim() === "").map(([k]) => k);
    expect(bad).toEqual([]);
  });

  it("both languages use the same {placeholders} for each key", () => {
    const mismatched = [...en.keys()].filter((k) => ar.has(k) && placeholders(en.get(k)).join() !== placeholders(ar.get(k)).join());
    expect(mismatched).toEqual([]);
  });
});
