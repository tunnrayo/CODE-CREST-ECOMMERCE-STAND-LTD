/**
 * Generates an ORIGINAL Code Crest product illustration (800×800 WebP) for
 * every catalogue product, using Phosphor Icons (MIT licence) composed on a
 * branded background. These are clearly-labelled development illustrations,
 * NOT product photographs. Replace them with verified supplier/manufacturer
 * photos (via Admin → Images) once usage permission is confirmed.
 *
 * Usage: npm run images:generate
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { PRODUCT_VISUALS } from "../data/product-visuals";
import { BRAND } from "../src/lib/brand";

const ICON_DIR = path.join(process.cwd(), "node_modules/@phosphor-icons/core/assets/duotone");
const OUT_DIR = path.join(process.cwd(), "public/products");

function iconInner(name: string, main: string, accent: string): string {
  const file = path.join(ICON_DIR, `${name}-duotone.svg`);
  if (!fs.existsSync(file)) throw new Error(`Icon not found: ${name}`);
  const svg = fs.readFileSync(file, "utf8");
  const inner = svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  // duotone layer = elements with opacity="0.2"; colour them with the accent
  return inner
    .replace(/opacity="0.2"/g, `fill="${accent}" opacity="0.95"`)
    .replace(/<(path|circle|rect|polygon|line|polyline|ellipse)(?![^>]*fill=)/g, `<$1 fill="${main}"`);
}

export function buildSvg(primary: string, badge: string | null, seed: number): string {
  const { burgundy, deepBurgundy, lime, grey } = BRAND.colors;
  const rot = (seed * 37) % 360;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="${grey}"/></linearGradient>
    <radialGradient id="disc" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="${burgundy}"/><stop offset="1" stop-color="${deepBurgundy}"/></radialGradient>
  </defs>
  <rect width="800" height="800" fill="url(#bg)"/>
  <g transform="rotate(${rot} 400 400)" opacity="0.10"><circle cx="400" cy="400" r="360" fill="none" stroke="${burgundy}" stroke-width="2" stroke-dasharray="6 14"/></g>
  <path d="M120 640 C 300 560, 520 720, 720 560 L 720 600 C 520 760, 300 610, 120 680 Z" fill="${lime}" opacity="0.55"/>
  <circle cx="400" cy="390" r="250" fill="url(#disc)"/>
  <g fill="${lime}" opacity="0.9"><rect x="70" y="330" width="80" height="16" rx="8"/><rect x="40" y="370" width="110" height="16" rx="8"/><rect x="90" y="410" width="60" height="16" rx="8"/></g>
  <g transform="translate(250 240) scale(1.17)">${iconInner(primary, "#FFFFFF", lime)}</g>
  ${
    badge
      ? `<circle cx="600" cy="200" r="78" fill="${lime}" stroke="#FFFFFF" stroke-width="10"/><g transform="translate(552 152) scale(0.375)">${iconInner(badge, burgundy, burgundy)}</g>`
      : ""
  }
</svg>`;
}

async function main() {
  const catalogue = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data/catalogue.json"), "utf8")) as { sku: string; slug: string }[];
  fs.mkdirSync(OUT_DIR, { recursive: true });
  let i = 0;
  for (const p of catalogue) {
    const v = PRODUCT_VISUALS[p.sku];
    if (!v) throw new Error(`No visual mapping for ${p.sku}`);
    const svg = buildSvg(v[0], v[1], i++);
    await sharp(Buffer.from(svg)).webp({ quality: 86 }).toFile(path.join(OUT_DIR, `${p.slug}.webp`));
  }
  console.log(`Generated ${catalogue.length} product illustrations in public/products/`);
}

if (require.main === module || process.argv[1]?.endsWith("generate-product-images.ts")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
