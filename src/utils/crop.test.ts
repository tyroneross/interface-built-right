/**
 * Unit tests for src/utils/crop.ts.
 *
 * Generates a small synthetic PNG in memory, crops it, reads back
 * dimensions to assert the rectangle was correctly extracted.
 */

import { describe, it, expect } from 'vitest'
import { writeFileSync, readFileSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { PNG } from 'pngjs'
import { cropPng } from './crop.js'

function synthesizePng(path: string, width: number, height: number): void {
  const png = new PNG({ width, height })
  // Fill with a gradient so we can later check pixels survived intact.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) << 2
      png.data[idx + 0] = (x * 255) / width
      png.data[idx + 1] = (y * 255) / height
      png.data[idx + 2] = 0
      png.data[idx + 3] = 255
    }
  }
  writeFileSync(path, PNG.sync.write(png))
}

function readDims(path: string): { width: number; height: number } {
  const png = PNG.sync.read(readFileSync(path))
  return { width: png.width, height: png.height }
}

const tmp = join(tmpdir(), 'ibr-crop-test')
mkdirSync(tmp, { recursive: true })

describe('cropPng', () => {
  it('extracts a sub-rectangle with default padding', async () => {
    const src = join(tmp, 'src.png')
    const dest = join(tmp, 'crop.png')
    synthesizePng(src, 200, 200)
    const out = await cropPng(src, { x: 50, y: 50, width: 30, height: 30 }, dest)
    expect(out).toBe(dest)
    const dims = readDims(dest)
    // 30+30 (bounds) + 16+16 (padding) = 62 each side
    expect(dims.width).toBe(62)
    expect(dims.height).toBe(62)
  })

  it('clamps the rectangle to the source image dimensions', async () => {
    const src = join(tmp, 'src2.png')
    const dest = join(tmp, 'crop2.png')
    synthesizePng(src, 100, 100)
    // Top-left corner near origin — padding would push it negative; expect clamp.
    const out = await cropPng(src, { x: 0, y: 0, width: 20, height: 20 }, dest, { padding: 16 })
    expect(out).toBe(dest)
    const dims = readDims(dest)
    expect(dims.width).toBe(36) // 0 → min(0+20+16, 100) = 36
    expect(dims.height).toBe(36)
  })

  it('returns null for zero-area rectangles', async () => {
    const src = join(tmp, 'src3.png')
    const dest = join(tmp, 'crop3.png')
    synthesizePng(src, 100, 100)
    const out = await cropPng(src, { x: 1000, y: 1000, width: 10, height: 10 }, dest, { padding: 0 })
    expect(out).toBeNull()
  })

  it('honours scale factor for native iOS screenshots', async () => {
    const src = join(tmp, 'src4.png')
    const dest = join(tmp, 'crop4.png')
    synthesizePng(src, 600, 600) // simulate 3× of 200×200 logical
    // Logical bounds (50, 50, 30, 30) at scale 3 → image px (150, 150, 90, 90).
    const out = await cropPng(src, { x: 50, y: 50, width: 30, height: 30 }, dest, {
      padding: 16,
      scale: 3,
    })
    expect(out).toBe(dest)
    const dims = readDims(dest)
    // (50-16)*3=102 → 102; (50+30+16)*3=288 → 288. width=288-102=186.
    expect(dims.width).toBe(186)
    expect(dims.height).toBe(186)
  })

  // Cleanup at end of suite.
  it('cleanup', () => {
    rmSync(tmp, { recursive: true, force: true })
    expect(true).toBe(true)
  })
})
