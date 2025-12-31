const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ICON_SIZE = 1024;
const ASSETS_DIR = path.join(__dirname, '..', 'assets');

// SVG for the main app icon - a modern bell/alert icon
const createIconSVG = (size, isAdaptive = false) => {
  const padding = isAdaptive ? size * 0.2 : size * 0.1;
  const iconSize = size - (padding * 2);
  const centerX = size / 2;
  const centerY = size / 2;

  // Colors
  const gradientStart = '#3B82F6'; // Blue 500
  const gradientEnd = '#1E40AF';   // Blue 800
  const bellColor = '#FFFFFF';

  return `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${gradientStart};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${gradientEnd};stop-opacity:1" />
    </linearGradient>
    <linearGradient id="bellGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#FFFFFF;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#E2E8F0;stop-opacity:1" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#1E3A8A" flood-opacity="0.3"/>
    </filter>
  </defs>

  <!-- Background -->
  ${isAdaptive ? '' : `<rect width="${size}" height="${size}" rx="${size * 0.22}" fill="url(#bgGradient)"/>`}
  ${isAdaptive ? `<rect width="${size}" height="${size}" fill="url(#bgGradient)"/>` : ''}

  <!-- Bell Icon -->
  <g transform="translate(${centerX}, ${centerY - iconSize * 0.02})" filter="url(#shadow)">
    <!-- Bell body -->
    <path d="
      M 0 ${-iconSize * 0.32}
      C ${iconSize * 0.18} ${-iconSize * 0.32} ${iconSize * 0.28} ${-iconSize * 0.22} ${iconSize * 0.28} ${-iconSize * 0.05}
      L ${iconSize * 0.28} ${iconSize * 0.12}
      C ${iconSize * 0.28} ${iconSize * 0.16} ${iconSize * 0.32} ${iconSize * 0.2} ${iconSize * 0.35} ${iconSize * 0.2}
      L ${-iconSize * 0.35} ${iconSize * 0.2}
      C ${-iconSize * 0.32} ${iconSize * 0.2} ${-iconSize * 0.28} ${iconSize * 0.16} ${-iconSize * 0.28} ${iconSize * 0.12}
      L ${-iconSize * 0.28} ${-iconSize * 0.05}
      C ${-iconSize * 0.28} ${-iconSize * 0.22} ${-iconSize * 0.18} ${-iconSize * 0.32} 0 ${-iconSize * 0.32}
      Z
    " fill="url(#bellGradient)"/>

    <!-- Bell top (handle) -->
    <circle cx="0" cy="${-iconSize * 0.35}" r="${iconSize * 0.06}" fill="${bellColor}"/>

    <!-- Bell clapper -->
    <ellipse cx="0" cy="${iconSize * 0.28}" rx="${iconSize * 0.08}" ry="${iconSize * 0.05}" fill="${bellColor}"/>

    <!-- Alert dot -->
    <circle cx="${iconSize * 0.22}" cy="${-iconSize * 0.22}" r="${iconSize * 0.09}" fill="#EF4444"/>
    <circle cx="${iconSize * 0.22}" cy="${-iconSize * 0.22}" r="${iconSize * 0.05}" fill="#FEE2E2"/>
  </g>
</svg>
  `.trim();
};

// Create splash screen SVG
const createSplashSVG = (width, height) => {
  return `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="splashGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#3B82F6;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1E40AF;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#splashGradient)"/>

  <!-- Centered bell icon -->
  <g transform="translate(${width/2}, ${height/2 - 50})">
    <path d="
      M 0 -80
      C 45 -80 70 -55 70 -12
      L 70 30
      C 70 40 80 50 88 50
      L -88 50
      C -80 50 -70 40 -70 30
      L -70 -12
      C -70 -55 -45 -80 0 -80
      Z
    " fill="#FFFFFF"/>
    <circle cx="0" cy="-88" r="15" fill="#FFFFFF"/>
    <ellipse cx="0" cy="70" rx="20" ry="12" fill="#FFFFFF"/>
    <circle cx="55" cy="-55" r="22" fill="#EF4444"/>
    <circle cx="55" cy="-55" r="12" fill="#FEE2E2"/>
  </g>

  <!-- App name -->
  <text x="${width/2}" y="${height/2 + 120}" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="#FFFFFF" text-anchor="middle">OnCallShift</text>
</svg>
  `.trim();
};

async function generateIcons() {
  console.log('Generating OnCallShift icons...\n');

  // Generate main icon (1024x1024 with rounded corners)
  console.log('Creating icon.png...');
  const iconSVG = createIconSVG(ICON_SIZE, false);
  await sharp(Buffer.from(iconSVG))
    .resize(ICON_SIZE, ICON_SIZE)
    .png()
    .toFile(path.join(ASSETS_DIR, 'icon.png'));
  console.log('  ✓ icon.png (1024x1024)');

  // Generate adaptive icon (1024x1024, full bleed for Android)
  console.log('Creating adaptive-icon.png...');
  const adaptiveIconSVG = createIconSVG(ICON_SIZE, true);
  await sharp(Buffer.from(adaptiveIconSVG))
    .resize(ICON_SIZE, ICON_SIZE)
    .png()
    .toFile(path.join(ASSETS_DIR, 'adaptive-icon.png'));
  console.log('  ✓ adaptive-icon.png (1024x1024)');

  // Generate splash screen (2048x2048)
  console.log('Creating splash.png...');
  const splashSVG = createSplashSVG(2048, 2048);
  await sharp(Buffer.from(splashSVG))
    .resize(2048, 2048)
    .png()
    .toFile(path.join(ASSETS_DIR, 'splash.png'));
  console.log('  ✓ splash.png (2048x2048)');

  console.log('\n✅ All icons generated successfully!');
}

generateIcons().catch(console.error);
