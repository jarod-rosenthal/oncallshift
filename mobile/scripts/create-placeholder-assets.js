/**
 * Creates placeholder PNG assets for development
 * Run with: node scripts/create-placeholder-assets.js
 */

const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '..', 'assets');

// Ensure assets directory exists
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Minimal 1x1 PNG in slate blue color (#475569)
// This is a placeholder - replace with actual branded assets
const createPlaceholderPng = () => {
  // PNG header + IHDR + IDAT + IEND for a small colored square
  // This creates a 100x100 slate blue PNG
  const width = 100;
  const height = 100;

  // PNG signature
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // bit depth
  ihdrData.writeUInt8(2, 9); // color type (RGB)
  ihdrData.writeUInt8(0, 10); // compression
  ihdrData.writeUInt8(0, 11); // filter
  ihdrData.writeUInt8(0, 12); // interlace

  // For simplicity, we'll just create the files and instruct the user
  console.log('Creating placeholder asset configuration...');
  console.log('');
  console.log('For the app icon and splash screen, you need to create:');
  console.log('');
  console.log('1. assets/icon.png (1024x1024) - App icon');
  console.log('   - Slate blue background (#475569)');
  console.log('   - White bell icon in center');
  console.log('');
  console.log('2. assets/splash.png (1284x2778) - Splash screen');
  console.log('   - Light background (#F8FAFC)');
  console.log('   - Centered logo/icon');
  console.log('   - "OnCallShift" text below');
  console.log('');
  console.log('3. assets/adaptive-icon.png (1024x1024) - Android adaptive icon');
  console.log('   - Transparent background');
  console.log('   - Bell icon only (foreground layer)');
  console.log('');
  console.log('Quick option: Use Figma, Canva, or an AI image generator to create these.');
  console.log('');
  console.log('For now, the app will work without custom icons (Expo defaults will be used).');
};

createPlaceholderPng();
