import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import catalogue from "../data/catalogue.json";

const manifest = JSON.parse(fs.readFileSync("data/image-manifest.json", "utf8")) as { sku: string; file: string; boardLabel: string; match: string }[];
const skus = new Set((catalogue as { sku: string }[]).map((c) => c.sku));

describe("product image manifest", () => {
  it("references only real catalogue SKUs, once each", () => {
    expect(new Set(manifest.map((m) => m.sku)).size).toBe(manifest.length);
    for (const m of manifest) expect(skus.has(m.sku), m.sku).toBe(true);
  });
  it("every referenced file exists locally", () => {
    for (const m of manifest) expect(fs.existsSync(path.join("public", m.file)), m.file).toBe(true);
  });
  it("no stray image files that are not in the manifest", () => {
    const files = fs.readdirSync("public/products");
    const listed = new Set(manifest.map((m) => path.basename(m.file)));
    for (const f of files) expect(listed.has(f), f).toBe(true);
  });
  it("matches are by name only: every board label shares a distinctive word with the product name", () => {
    const names = new Map((catalogue as { sku: string; name: string }[]).map((c) => [c.sku, c.name.toLowerCase()]));
    const stop = new Set(["and", "with", "set", "the", "of", "for", "a"]);
    for (const m of manifest) {
      const a = new Set(m.boardLabel.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !stop.has(w)));
      const b = names.get(m.sku)!.split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !stop.has(w));
      expect(b.some((w) => a.has(w)), `${m.sku}: ${m.boardLabel}`).toBe(true);
    }
  });
});
