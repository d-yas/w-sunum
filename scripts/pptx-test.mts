// Builds a sample .pptx from the smoke-test PNGs, without the browser.
// Usage: node --experimental-strip-types scripts/pptx-test.mts
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { buildPptx } from "../src/lib/pptx.ts";

const candidates = ["bar-light", "line-light", "ring-light", "sankey-light", "heatmap-light", "barH-light", "area-dark"];
const slides = candidates
  .map((k) => `scripts/out/export-${k}.png`)
  .filter((p) => existsSync(p))
  .map((p, i) => ({
    png: new Uint8Array(readFileSync(p)),
    width: 1920,
    height: 1080,
    background: p.includes("dark") ? "1A1A19" : null,
    name: `Test ${i + 1}`,
  }));
if (slides.length === 0) throw new Error("scripts/out içinde export-*.png yok — önce pnpm kontrol çalıştırın.");
const bytes = buildPptx(slides, "Veri Görsel test");
writeFileSync("scripts/out/test.pptx", bytes);
console.log(`scripts/out/test.pptx yazıldı: ${slides.length} slayt, ${Math.round(bytes.length / 1024)} KB`);
