/**
 * generate-icons.mjs
 * Generates branded ClearCase app icons and splash screen assets.
 *
 * Brand: dark navy (#0F172A) background, white shield/document icon
 * Run: node scripts/generate-icons.mjs
 */
import sharp from "sharp";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { mkdirSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(__dirname, "..", "apps", "mobile", "assets");

// Brand colors
const NAVY = "#0F172A";
const WHITE = "#FFFFFF";
const GREEN = "#166534";

/**
 * Creates an SVG for the app icon.
 * Design: dark navy rounded-rect background, white shield with a document
 * inside — represents legal protection/clarity.
 */
function iconSvg(size) {
  const pad = Math.round(size * 0.18);
  const shieldW = size - pad * 2;
  const shieldH = Math.round(shieldW * 1.15);
  const cx = size / 2;
  const shieldTop = Math.round((size - shieldH) / 2) - Math.round(size * 0.02);

  // Shield path (pointed bottom)
  const sl = cx - shieldW / 2;
  const sr = cx + shieldW / 2;
  const st = shieldTop;
  const smid = st + shieldH * 0.55;
  const sb = st + shieldH;
  const r = Math.round(shieldW * 0.12);

  // Document inside shield
  const docW = Math.round(shieldW * 0.38);
  const docH = Math.round(shieldH * 0.42);
  const docL = cx - docW / 2;
  const docT = st + shieldH * 0.18;
  const fold = Math.round(docW * 0.28);
  const lineY1 = docT + docH * 0.45;
  const lineY2 = docT + docH * 0.6;
  const lineY3 = docT + docH * 0.75;
  const lineL = docL + docW * 0.15;
  const lineR = docL + docW * 0.75;
  const lineShort = docL + docW * 0.55;

  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.22)}" fill="${NAVY}"/>

  <!-- Shield outline -->
  <path d="
    M ${sl + r} ${st}
    L ${sr - r} ${st}
    Q ${sr} ${st} ${sr} ${st + r}
    L ${sr} ${smid}
    Q ${sr} ${sb - shieldH * 0.1} ${cx} ${sb}
    Q ${sl} ${sb - shieldH * 0.1} ${sl} ${smid}
    L ${sl} ${st + r}
    Q ${sl} ${st} ${sl + r} ${st}
    Z
  " fill="none" stroke="${WHITE}" stroke-width="${Math.max(2, Math.round(size * 0.025))}" opacity="0.95"/>

  <!-- Document body -->
  <path d="
    M ${docL} ${docT}
    L ${docL + docW - fold} ${docT}
    L ${docL + docW} ${docT + fold}
    L ${docL + docW} ${docT + docH}
    L ${docL} ${docT + docH}
    Z
  " fill="${WHITE}" opacity="0.9"/>

  <!-- Fold triangle -->
  <path d="
    M ${docL + docW - fold} ${docT}
    L ${docL + docW - fold} ${docT + fold}
    L ${docL + docW} ${docT + fold}
    Z
  " fill="${NAVY}" opacity="0.2"/>

  <!-- Text lines on document -->
  <line x1="${lineL}" y1="${lineY1}" x2="${lineR}" y2="${lineY1}" stroke="${NAVY}" stroke-width="${Math.max(1.5, Math.round(size * 0.015))}" stroke-linecap="round" opacity="0.5"/>
  <line x1="${lineL}" y1="${lineY2}" x2="${lineR}" y2="${lineY2}" stroke="${NAVY}" stroke-width="${Math.max(1.5, Math.round(size * 0.015))}" stroke-linecap="round" opacity="0.5"/>
  <line x1="${lineL}" y1="${lineY3}" x2="${lineShort}" y2="${lineY3}" stroke="${NAVY}" stroke-width="${Math.max(1.5, Math.round(size * 0.015))}" stroke-linecap="round" opacity="0.35"/>

  <!-- Small checkmark on shield (bottom-right, represents clarity/done) -->
  <g transform="translate(${cx + shieldW * 0.12}, ${st + shieldH * 0.7})">
    <circle cx="0" cy="0" r="${Math.round(size * 0.06)}" fill="${GREEN}"/>
    <polyline points="${-size * 0.025},${0} ${-size * 0.008},${size * 0.02} ${size * 0.025},${-size * 0.018}"
      fill="none" stroke="${WHITE}" stroke-width="${Math.max(1.5, Math.round(size * 0.018))}" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;
}

/**
 * Creates splash screen SVG — centered brand mark on dark navy.
 */
function splashSvg(w, h) {
  const iconSize = Math.round(Math.min(w, h) * 0.2);
  const cx = w / 2;
  const cy = h / 2 - Math.round(h * 0.04);

  // Simplified shield + document for splash (smaller, centered)
  const shieldW = iconSize;
  const shieldH = Math.round(iconSize * 1.15);
  const sl = cx - shieldW / 2;
  const sr = cx + shieldW / 2;
  const st = cy - shieldH / 2;
  const smid = st + shieldH * 0.55;
  const sb = st + shieldH;
  const r = Math.round(shieldW * 0.12);

  const docW = Math.round(shieldW * 0.38);
  const docH = Math.round(shieldH * 0.42);
  const docL = cx - docW / 2;
  const docT = st + shieldH * 0.18;
  const fold = Math.round(docW * 0.28);

  const textY = sb + Math.round(h * 0.05);

  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${w}" height="${h}" fill="${NAVY}"/>

  <!-- Shield -->
  <path d="
    M ${sl + r} ${st}
    L ${sr - r} ${st}
    Q ${sr} ${st} ${sr} ${st + r}
    L ${sr} ${smid}
    Q ${sr} ${sb - shieldH * 0.1} ${cx} ${sb}
    Q ${sl} ${sb - shieldH * 0.1} ${sl} ${smid}
    L ${sl} ${st + r}
    Q ${sl} ${st} ${sl + r} ${st}
    Z
  " fill="none" stroke="${WHITE}" stroke-width="${Math.max(2, Math.round(iconSize * 0.025))}" opacity="0.95"/>

  <!-- Document -->
  <path d="
    M ${docL} ${docT}
    L ${docL + docW - fold} ${docT}
    L ${docL + docW} ${docT + fold}
    L ${docL + docW} ${docT + docH}
    L ${docL} ${docT + docH}
    Z
  " fill="${WHITE}" opacity="0.9"/>

  <!-- Brand name -->
  <text x="${cx}" y="${textY}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif"
    font-size="${Math.round(h * 0.035)}" font-weight="700" letter-spacing="3" fill="${WHITE}" opacity="0.95">
    CLEARCASE
  </text>

  <text x="${cx}" y="${textY + Math.round(h * 0.025)}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif"
    font-size="${Math.round(h * 0.014)}" font-weight="400" letter-spacing="2" fill="${WHITE}" opacity="0.5">
    UNDERSTAND YOUR RIGHTS
  </text>
</svg>`;
}

async function generate() {
  mkdirSync(ASSETS, { recursive: true });

  // App icon (1024x1024 master)
  const icon1024 = Buffer.from(iconSvg(1024));
  await sharp(icon1024).png().toFile(join(ASSETS, "icon.png"));
  console.log("  icon.png (1024x1024)");

  // Adaptive icon foreground (1024x1024, with extra padding for safe zone)
  // Android adaptive icons use 108dp with 72dp safe zone (66.67%)
  const adaptiveSize = 1024;
  const innerSize = Math.round(adaptiveSize * 0.65);
  const innerIcon = Buffer.from(iconSvg(innerSize));
  const innerPng = await sharp(innerIcon).png().toBuffer();
  const pad = Math.round((adaptiveSize - innerSize) / 2);

  await sharp({
    create: { width: adaptiveSize, height: adaptiveSize, channels: 4, background: { r: 15, g: 23, b: 42, alpha: 1 } }
  })
    .composite([{ input: innerPng, top: pad, left: pad }])
    .png()
    .toFile(join(ASSETS, "adaptive-icon.png"));
  console.log("  adaptive-icon.png (1024x1024)");

  // Favicon (48x48)
  const fav = Buffer.from(iconSvg(48));
  await sharp(fav).png().toFile(join(ASSETS, "favicon.png"));
  console.log("  favicon.png (48x48)");

  // Splash icon (centered brand mark, 200x200 at splash scale)
  const splashIcon = Buffer.from(iconSvg(200));
  await sharp(splashIcon).png().toFile(join(ASSETS, "splash-icon.png"));
  console.log("  splash-icon.png (200x200)");

  console.log("\nAll icons generated in apps/mobile/assets/");
}

generate().catch((err) => {
  console.error("Icon generation failed:", err);
  process.exit(1);
});
