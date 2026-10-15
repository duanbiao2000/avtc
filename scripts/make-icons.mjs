/**
 * Generates public/icons/{16,32,48,128}.png — a Klein blue rounded square with a
 * white "AV". No dependencies: a minimal RGBA PNG encoder + a 4x supersampled
 * rasteriser (the letters are drawn as strokes with a distance test).
 *
 *   node scripts/make-icons.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
const SIZES = [16, 32, 48, 128];

const KLEIN = [0x00, 0x2f, 0xa7];
const WHITE = [0xff, 0xff, 0xff];

/* ---------- PNG encoding ---------- */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

function encodePng(size, rgba) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * stride] = 0; // filter: none
    rgba.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------- geometry (unit square coordinates) ---------- */

function insideRoundedSquare(x, y) {
  const pad = 0.02;
  const radius = 0.22;
  const lo = pad + radius;
  const hi = 1 - pad - radius;
  const cx = Math.min(Math.max(x, lo), hi);
  const cy = Math.min(Math.max(y, lo), hi);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= radius * radius;
}

function distanceToSegment(x, y, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.min(Math.max(((x - x1) * dx + (y - y1) * dy) / lengthSq, 0), 1);
  const px = x1 + t * dx;
  const py = y1 + t * dy;
  return Math.hypot(x - px, y - py);
}

function insideLetterA(x, y) {
  const w = 0.058;
  const apexX = 0.345;
  const apexY = 0.255;
  const footY = 0.765;
  return (
    distanceToSegment(x, y, apexX, apexY, 0.205, footY) <= w ||
    distanceToSegment(x, y, apexX, apexY, 0.485, footY) <= w ||
    distanceToSegment(x, y, 0.258, 0.615, 0.432, 0.615) <= w * 0.8
  );
}

function insideLetterV(x, y) {
  const w = 0.058;
  const topY = 0.255;
  const bottomX = 0.715;
  const bottomY = 0.765;
  return (
    distanceToSegment(x, y, 0.585, topY, bottomX, bottomY) <= w ||
    distanceToSegment(x, y, 0.845, topY, bottomX, bottomY) <= w
  );
}

function insideInk(x, y) {
  return insideLetterA(x, y) || insideLetterV(x, y);
}

/* ---------- rasteriser ---------- */

function render(size) {
  const sub = 4;
  const total = sub * sub;
  const rgba = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let covered = 0;
      let ink = 0;

      for (let sy = 0; sy < sub; sy += 1) {
        for (let sx = 0; sx < sub; sx += 1) {
          const u = (x + (sx + 0.5) / sub) / size;
          const v = (y + (sy + 0.5) / sub) / size;
          if (!insideRoundedSquare(u, v)) continue;
          covered += 1;
          if (insideInk(u, v)) ink += 1;
        }
      }

      const index = (y * size + x) * 4;
      const inkRatio = covered === 0 ? 0 : ink / covered;

      rgba[index] = Math.round(KLEIN[0] * (1 - inkRatio) + WHITE[0] * inkRatio);
      rgba[index + 1] = Math.round(KLEIN[1] * (1 - inkRatio) + WHITE[1] * inkRatio);
      rgba[index + 2] = Math.round(KLEIN[2] * (1 - inkRatio) + WHITE[2] * inkRatio);
      rgba[index + 3] = Math.round((covered / total) * 255);
    }
  }

  return rgba;
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of SIZES) {
  const file = join(OUT_DIR, `${size}.png`);
  writeFileSync(file, encodePng(size, render(size)));
  console.log(`icons/${size}.png`);
}
