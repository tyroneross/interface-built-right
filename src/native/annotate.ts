import { PNG } from 'pngjs';
import { readFileSync, writeFileSync } from 'fs';

export interface AnnotationTarget {
  id: number;
  bounds: { x: number; y: number; width: number; height: number };
}

// 5x7 bitmap font for digits 0-9
const DIGITS: number[][] = [
  [0x1F,0x11,0x11,0x11,0x11,0x11,0x1F], // 0
  [0x04,0x06,0x04,0x04,0x04,0x04,0x0E], // 1
  [0x1F,0x10,0x10,0x1F,0x01,0x01,0x1F], // 2
  [0x1F,0x10,0x10,0x1F,0x10,0x10,0x1F], // 3
  [0x11,0x11,0x11,0x1F,0x10,0x10,0x10], // 4
  [0x1F,0x01,0x01,0x1F,0x10,0x10,0x1F], // 5
  [0x1F,0x01,0x01,0x1F,0x11,0x11,0x1F], // 6
  [0x1F,0x10,0x10,0x08,0x04,0x04,0x04], // 7
  [0x1F,0x11,0x11,0x1F,0x11,0x11,0x1F], // 8
  [0x1F,0x11,0x11,0x1F,0x10,0x10,0x1F], // 9
];

function setPixel(png: PNG, x: number, y: number, r: number, g: number, b: number, a = 255) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const idx = (y * png.width + x) * 4;
  png.data[idx] = r; png.data[idx+1] = g; png.data[idx+2] = b; png.data[idx+3] = a;
}

function drawRect(png: PNG, x: number, y: number, w: number, h: number, r: number, g: number, b: number, thickness = 2) {
  for (let t = 0; t < thickness; t++) {
    for (let i = x; i < x + w; i++) { setPixel(png, i, y + t, r, g, b); setPixel(png, i, y + h - 1 - t, r, g, b); }
    for (let j = y; j < y + h; j++) { setPixel(png, x + t, j, r, g, b); setPixel(png, x + w - 1 - t, j, r, g, b); }
  }
}

function drawFilledCircle(png: PNG, cx: number, cy: number, radius: number, r: number, g: number, b: number) {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy <= radius * radius) setPixel(png, cx + dx, cy + dy, r, g, b);
    }
  }
}

function drawDigit(png: PNG, cx: number, cy: number, digit: number, r: number, g: number, b: number) {
  const rows = DIGITS[digit] ?? DIGITS[0];
  const scale = 2;
  const offX = cx - Math.floor((5 * scale) / 2);
  const offY = cy - Math.floor((7 * scale) / 2);
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 5; col++) {
      if (rows[row] & (0x10 >> col)) {
        for (let sy = 0; sy < scale; sy++)
          for (let sx = 0; sx < scale; sx++)
            setPixel(png, offX + col * scale + sx, offY + row * scale + sy, r, g, b);
      }
    }
  }
}

function drawLabel(png: PNG, cx: number, cy: number, id: number) {
  drawFilledCircle(png, cx, cy, 10, 220, 30, 30);
  const tens = Math.floor(id / 10);
  const ones = id % 10;
  if (tens > 0) {
    drawDigit(png, cx - 5, cy, tens, 255, 255, 255);
    drawDigit(png, cx + 5, cy, ones, 255, 255, 255);
  } else {
    drawDigit(png, cx, cy, ones, 255, 255, 255);
  }
}

export async function annotateScreenshot(
  screenshotPath: string,
  issues: AnnotationTarget[]
): Promise<string | null> {
  let png: PNG;
  try {
    const buf = readFileSync(screenshotPath);
    png = PNG.sync.read(buf);
  } catch {
    return null;
  }

  for (const issue of issues) {
    const { x, y, width: w, height: h } = issue.bounds;
    drawRect(png, x, y, w, h, 220, 30, 30, 2);
    drawLabel(png, x, y, issue.id);
  }

  const outPath = screenshotPath.replace(/\.png$/i, '-annotated.png');
  try {
    writeFileSync(outPath, PNG.sync.write(png));
  } catch {
    return null;
  }
  return outPath;
}
