import { describe, expect, it } from "vitest";
import { stat, readFile } from "node:fs/promises";
import path from "node:path";
import { PRODUCT_COLLECTIONS, STUDIO_LOOKS, STYLE_LIST } from "@packshot/core";
import sharp from "sharp";

describe("complete photographic visual library", () => {
  it("has a usable individual image for every category and studio look", async () => {
    for (const look of [...PRODUCT_COLLECTIONS.flatMap(c=>c.looks), ...STUDIO_LOOKS]) {
      const file=path.join(process.cwd(),"public","looks",look.id+".webp");
      expect((await stat(file)).size,look.id).toBeGreaterThan(1000);
      const meta=await sharp(await readFile(file)).metadata();
      expect(meta.width,look.id).toBeGreaterThanOrEqual(512);
      expect(meta.height,look.id).toBeGreaterThanOrEqual(512);
    }
  });
  it("has a real photo for every legacy scene instead of gradient placeholders", async () => {
    for (const scene of STYLE_LIST.filter(s=>s.id!=="custom")) {
      expect((await stat(path.join(process.cwd(),"public","scenes",scene.id+".webp"))).size,scene.id).toBeGreaterThan(1000);
    }
  });
});
