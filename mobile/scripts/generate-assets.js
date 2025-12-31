/**
 * Simple script to generate placeholder app icon and splash screen
 * Run with: node scripts/generate-assets.js
 *
 * For production, replace with professionally designed assets.
 */

const fs = require('fs');
const path = require('path');

// Slate blue color from theme
const PRIMARY_COLOR = '#475569';
const ACCENT_COLOR = '#6366F1';
const BACKGROUND_COLOR = '#F8FAFC';

// Create SVG icon (bell ring icon similar to app)
const iconSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${PRIMARY_COLOR}"/>
      <stop offset="100%" style="stop-color:${ACCENT_COLOR}"/>
    </linearGradient>
  </defs>
  <!-- Background -->
  <rect width="1024" height="1024" rx="200" fill="url(#bgGradient)"/>
  <!-- Bell icon -->
  <g transform="translate(262, 200)" fill="white">
    <path d="M250 0C290 0 330 25 355 65L375 100C425 175 450 250 450 350V400C450 425 470 445 495 450L500 500H0L5 450C30 445 50 425 50 400V350C50 250 75 175 125 100L145 65C170 25 210 0 250 0ZM250 50C225 50 200 65 185 95L165 130C120 195 100 265 100 350V380H400V350C400 265 380 195 335 130L315 95C300 65 275 50 250 50Z"/>
    <path d="M175 525C175 575 210 625 250 625C290 625 325 575 325 525H375C375 600 320 675 250 675C180 675 125 600 125 525H175Z"/>
    <!-- Ring lines -->
    <path d="M50 150L100 200" stroke="white" stroke-width="20" stroke-linecap="round" opacity="0.8"/>
    <path d="M450 150L400 200" stroke="white" stroke-width="20" stroke-linecap="round" opacity="0.8"/>
  </g>
</svg>`;

// Create splash screen SVG
const splashSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1284" height="2778" viewBox="0 0 1284 2778" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="1284" height="2778" fill="${BACKGROUND_COLOR}"/>
  <!-- Centered icon -->
  <g transform="translate(492, 1189)">
    <circle cx="150" cy="150" r="150" fill="${PRIMARY_COLOR}"/>
    <g transform="translate(75, 70)" fill="white">
      <path d="M75 0C87 0 99 7.5 106.5 19.5L112.5 30C127.5 52.5 135 75 135 105V120C135 127.5 141 133.5 148.5 135L150 150H0L1.5 135C9 133.5 15 127.5 15 120V105C15 75 22.5 52.5 37.5 30L43.5 19.5C51 7.5 63 0 75 0Z"/>
      <path d="M52.5 157.5C52.5 172.5 63 187.5 75 187.5C87 187.5 97.5 172.5 97.5 157.5H112.5C112.5 180 96 202.5 75 202.5C54 202.5 37.5 180 37.5 157.5H52.5Z"/>
    </g>
  </g>
  <!-- App name -->
  <text x="642" y="1550" font-family="system-ui, -apple-system, sans-serif" font-size="72" font-weight="bold" fill="${PRIMARY_COLOR}" text-anchor="middle">OnCallShift</text>
  <text x="642" y="1620" font-family="system-ui, -apple-system, sans-serif" font-size="36" fill="#64748B" text-anchor="middle">Stay on top of incidents</text>
</svg>`;

// Create adaptive icon foreground (for Android)
const adaptiveIconSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="108" height="108" viewBox="0 0 108 108" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(27, 22)" fill="${PRIMARY_COLOR}">
    <path d="M27 0C31.4 0 35.8 2.7 38.5 7L40.7 10.8C46.2 18.9 48.7 27 48.7 37.8V43.2C48.7 45.9 51 48.1 53.6 48.6L54 54H0L0.5 48.6C3.2 48.1 5.4 45.9 5.4 43.2V37.8C5.4 27 7.9 18.9 13.4 10.8L15.6 7C18.3 2.7 22.6 0 27 0Z"/>
    <path d="M19 56.7C19 62.1 22.8 67.5 27 67.5C31.3 67.5 35.1 62.1 35.1 56.7H40.5C40.5 64.8 34.6 72.9 27 72.9C19.4 72.9 13.5 64.8 13.5 56.7H19Z"/>
  </g>
</svg>`;

const assetsDir = path.join(__dirname, '..', 'assets');

// Ensure assets directory exists
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Write SVG files
fs.writeFileSync(path.join(assetsDir, 'icon.svg'), iconSvg);
fs.writeFileSync(path.join(assetsDir, 'splash.svg'), splashSvg);
fs.writeFileSync(path.join(assetsDir, 'adaptive-icon.svg'), adaptiveIconSvg);

console.log('SVG assets generated in assets/ folder');
console.log('');
console.log('To convert to PNG (required for Expo):');
console.log('1. Use an online tool like https://svgtopng.com/');
console.log('2. Or install sharp: npm install -D sharp');
console.log('3. Convert icon.svg to icon.png (1024x1024)');
console.log('4. Convert splash.svg to splash.png (1284x2778)');
console.log('5. Convert adaptive-icon.svg to adaptive-icon.png (108x108)');
console.log('');
console.log('Or use Expo\'s built-in icon generator:');
console.log('npx expo-optimize');
