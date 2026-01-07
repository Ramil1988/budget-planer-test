import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '../public/icons');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Create icon with gradient background and money bag emoji
async function createIcon(size) {
  const rx = Math.round(size * 0.2); // Rounded corners
  const fontSize = Math.round(size * 0.55);

  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#18181B"/>
          <stop offset="100%" style="stop-color:#3B82F6"/>
        </linearGradient>
      </defs>
      <rect width="${size}" height="${size}" rx="${rx}" fill="url(#bgGradient)"/>
      <text x="50%" y="66%" font-size="${fontSize}" text-anchor="middle">💰</text>
    </svg>
  `;

  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(join(iconsDir, `icon-${size}x${size}.png`));

  console.log(`Created icon-${size}x${size}.png`);
}

async function main() {
  await mkdir(iconsDir, { recursive: true });

  for (const size of sizes) {
    await createIcon(size);
  }

  console.log('All icons created!');
}

main().catch(console.error);
