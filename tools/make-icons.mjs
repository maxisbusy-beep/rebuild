// Generates the PNG app icons (run once: node tools/make-icons.mjs). No dependencies.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');
mkdirSync(out, { recursive: true });

const BG = [0x0A, 0x0B, 0x0D];
const FG = [0xC8, 0xFF, 0x2E];

// Barbell in unit coordinates: [x0, y0, x1, y1, cornerRadius]. Kept inside the maskable safe zone.
const SHAPES = [
  [0.17, 0.475, 0.83, 0.525, 0.025], // bar
  [0.305, 0.30, 0.375, 0.70, 0.022], // inner plates
  [0.625, 0.30, 0.695, 0.70, 0.022],
  [0.225, 0.37, 0.285, 0.63, 0.020], // outer plates
  [0.715, 0.37, 0.775, 0.63, 0.020],
];

function inside(x, y) {
  for (const [x0, y0, x1, y1, r] of SHAPES) {
    if (x < x0 || x > x1 || y < y0 || y > y1) continue;
    const cx = Math.min(Math.max(x, x0 + r), x1 - r);
    const cy = Math.min(Math.max(y, y0 + r), y1 - r);
    if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) return true;
  }
  return false;
}

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (const b of buf) c = crcTable[(c ^ b) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size) {
  const SS = 4; // supersampling for smooth edges
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let py = 0; py < size; py++) {
    const row = py * (size * 3 + 1);
    raw[row] = 0;
    for (let px = 0; px < size; px++) {
      let hits = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        if (inside((px + (sx + 0.5) / SS) / size, (py + (sy + 0.5) / SS) / size)) hits++;
      }
      const a = hits / (SS * SS);
      for (let ch = 0; ch < 3; ch++) raw[row + 1 + px * 3 + ch] = Math.round(BG[ch] + (FG[ch] - BG[ch]) * a);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const [name, size] of [['icon-180.png', 180], ['icon-192.png', 192], ['icon-512.png', 512], ['icon-maskable-512.png', 512]]) {
  writeFileSync(join(out, name), png(size));
  console.log('wrote', name);
}

const rects = SHAPES.map(([x0, y0, x1, y1, r]) =>
  `<rect x="${x0 * 512}" y="${y0 * 512}" width="${((x1 - x0) * 512).toFixed(2)}" height="${((y1 - y0) * 512).toFixed(2)}" rx="${r * 512}"/>`).join('');
writeFileSync(join(out, 'icon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="#0A0B0D"/><g fill="#C8FF2E">${rects}</g></svg>\n`);
console.log('wrote icon.svg');
