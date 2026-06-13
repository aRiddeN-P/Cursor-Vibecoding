/**
 * generate-icons.js — Phase 3-F
 *
 * One-shot script that rasterizes a clean SVG logo of the Dakhlyar brand
 * mark (green rounded square + white "D" stem + gold accent dot) into all
 * the PNG sizes required by the PWA manifest, plus the notification badge.
 *
 * Usage:   node server/scripts/generate-icons.js
 *
 * Output:  public/icons/icon-{72,96,128,144,152,192,384,512}.png
 *          public/icons/badge-72.png   (monochrome white-on-transparent)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const OUT_DIR = path.resolve(__dirname, '..', '..', 'public', 'icons');

const COLORS = {
  green: '#1A5C3A',
  greenDeep: '#0D2E1E',
  gold: '#F0B429',
  white: '#FFFFFF',
};

function mainSvg(size) {
  const r = Math.round(size * 0.22);
  const stroke = Math.round(size * 0.06);
  const dotR = Math.round(size * 0.08);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%"  stop-color="${COLORS.green}"/>
      <stop offset="100%" stop-color="${COLORS.greenDeep}"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${size}" height="${size}" rx="${r}" ry="${r}" fill="url(#g)"/>
  <g transform="translate(${size * 0.27}, ${size * 0.22})" fill="none" stroke="${COLORS.white}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">
    <path d="M 0 0 L 0 ${size * 0.56} L ${size * 0.18} ${size * 0.56}
             C ${size * 0.40} ${size * 0.56} ${size * 0.46} ${size * 0.40} ${size * 0.46} ${size * 0.28}
             C ${size * 0.46} ${size * 0.16} ${size * 0.40} 0 ${size * 0.18} 0 Z"/>
  </g>
  <circle cx="${size * 0.72}" cy="${size * 0.28}" r="${dotR}" fill="${COLORS.gold}"/>
</svg>`;
}

// Notification badge — must be monochrome (white on transparent) per the spec
// for Android. Browsers ignore color but require alpha for the mask.
function badgeSvg(size) {
  const stroke = Math.round(size * 0.10);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <g transform="translate(${size * 0.27}, ${size * 0.18})" fill="none" stroke="#FFFFFF" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">
    <path d="M 0 0 L 0 ${size * 0.64} L ${size * 0.18} ${size * 0.64}
             C ${size * 0.40} ${size * 0.64} ${size * 0.46} ${size * 0.46} ${size * 0.46} ${size * 0.32}
             C ${size * 0.46} ${size * 0.18} ${size * 0.40} 0 ${size * 0.18} 0 Z"/>
  </g>
</svg>`;
}

async function renderPng(svgString, outPath) {
  await sharp(Buffer.from(svgString))
    .png({ compressionLevel: 9 })
    .toFile(outPath);
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
  for (const s of sizes) {
    const file = path.join(OUT_DIR, `icon-${s}.png`);
    await renderPng(mainSvg(s), file);
    console.log(`✓ ${path.relative(process.cwd(), file)}`);
  }

  const badge = path.join(OUT_DIR, 'badge-72.png');
  await renderPng(badgeSvg(72), badge);
  console.log(`✓ ${path.relative(process.cwd(), badge)}`);
}

main().catch((err) => {
  console.error('✗ generate-icons failed:', err);
  process.exit(1);
});
