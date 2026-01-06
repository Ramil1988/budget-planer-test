import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '../public/icons');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Create a simple icon with a "B" letter
async function createIcon(size) {
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" rx="${size * 0.15}" fill="#3182ce"/>
      <text
        x="50%"
        y="62%"
        font-family="Arial, sans-serif"
        font-size="${size * 0.55}"
        font-weight="bold"
        fill="white"
        text-anchor="middle"
      >B</text>
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
