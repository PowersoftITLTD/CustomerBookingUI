/**
 * inline-build.js
 * ───────────────────────────────────────────────────────────────────
 * Run AFTER ng build --configuration production
 *
 * Merges all JS and CSS from dist/25south-booking-form/ into a single
 * self-contained index.inlined.html for upload to NetSuite File Cabinet.
 *
 * NetSuite's media.nl file serving requires an auth token (h= param)
 * on every request, so individual JS/CSS assets cannot be loaded via
 * <base href>. Inlining everything into one file solves this completely.
 *
 * Usage:
 *   node inline-build.js
 *
 * Or as part of package.json scripts:
 *   "build:netsuite": "ng build --configuration production && node inline-build.js"
 * ───────────────────────────────────────────────────────────────────
 */

const fs   = require('fs');
const path = require('path');

const distDir   = path.join(__dirname, 'dist', '25south-booking-form');
const indexPath = path.join(distDir, 'index.html');
const outPath   = path.join(distDir, 'index.inlined.html');

// ── Verify dist exists ──────────────────────────────────────────────
if (!fs.existsSync(distDir)) {
  console.error('✗ dist/25south-booking-form/ not found.');
  console.error('  Run: ng build --configuration production');
  process.exit(1);
}

if (!fs.existsSync(indexPath)) {
  console.error('✗ dist/25south-booking-form/index.html not found.');
  console.error('  Run: ng build --configuration production');
  process.exit(1);
}

console.log('📦 Reading index.html…');
let html = fs.readFileSync(indexPath, 'utf8');

// ── Inline <link rel="stylesheet" href="...css"> ───────────────────
let cssCount = 0;
html = html.replace(/<link([^>]*)\shref="([^"]+\.css)"([^>]*)>/g, (match, pre, href, post) => {
  // Skip external URLs (fonts, CDN)
  if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//')) {
    return match;
  }
  const filePath = path.join(distDir, href);
  if (!fs.existsSync(filePath)) {
    console.warn(`  ⚠ CSS not found, skipping: ${href}`);
    return match;
  }
  const css = fs.readFileSync(filePath, 'utf8');
  cssCount++;
  console.log(`  ✓ Inlined CSS: ${href} (${(css.length / 1024).toFixed(1)} KB)`);
  return `<style>${css}</style>`;
});

// ── Inline <script src="...js"> ────────────────────────────────────
let jsCount = 0;
html = html.replace(/<script([^>]*)\ssrc="([^"]+)"([^>]*)><\/script>/g, (match, pre, src, post) => {
  // Skip external URLs
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('//')) {
    return match;
  }
  const filePath = path.join(distDir, src);
  if (!fs.existsSync(filePath)) {
    console.warn(`  ⚠ JS not found, skipping: ${src}`);
    return match;
  }
  const code = fs.readFileSync(filePath, 'utf8');
  jsCount++;
  console.log(`  ✓ Inlined JS:  ${src} (${(code.length / 1024).toFixed(1)} KB)`);
  // Preserve type="module" or other attributes but strip src
  return `<script${pre}${post}>${code}</script>`;
});

// ── Remove any <base href> — not needed when everything is inlined ──
html = html.replace(/<base[^>]*>/gi, '');

// ── Write output ────────────────────────────────────────────────────
fs.writeFileSync(outPath, html, 'utf8');

const sizeKB  = (fs.statSync(outPath).size / 1024).toFixed(1);
const sizeMB  = (fs.statSync(outPath).size / (1024 * 1024)).toFixed(2);

console.log('');
console.log('✅ Inlined HTML written to:');
console.log(`   ${outPath}`);
console.log('');
console.log(`   CSS files inlined : ${cssCount}`);
console.log(`   JS files inlined  : ${jsCount}`);
console.log(`   Final file size   : ${sizeKB} KB (${sizeMB} MB)`);
console.log('');
console.log('📤 Next step:');
console.log('   Upload dist/25south-booking-form/index.inlined.html');
console.log('   to NetSuite File Cabinet and note its Internal ID.');
console.log('   Set ANGULAR_INDEX_FILE_ID in 25south_booking_suitelet.js');
