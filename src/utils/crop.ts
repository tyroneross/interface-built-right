/**
 * PNG cropping helper. Uses the existing `pngjs` dependency — no native
 * tools, no shelling out, runs identically on macOS / Linux / Windows.
 *
 * Used by ask() / askStream() to attach per-finding cropped evidence to the
 * AskResponse. Token-economic: the agent gets the rectangle that matters,
 * not the whole page.
 */

import { createReadStream, createWriteStream } from 'fs'
import { mkdir } from 'fs/promises'
import { dirname } from 'path'
import { PNG } from 'pngjs'

export interface CropBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface CropOptions {
  /** Pixel padding added on every edge to give the agent context. Default 16. */
  padding?: number
  /**
   * Scale factor between logical bounds (CSS px) and screenshot pixels.
   * Default 1 (Playwright captures at 1:1 with viewport unless overridden).
   * iOS native screenshots are at native resolution — caller passes 3 for
   * iPhone Pro models, etc.
   */
  scale?: number
}

/** Read a PNG file into memory. */
function loadPng(path: string): Promise<PNG> {
  return new Promise((resolve, reject) => {
    const png = new PNG()
    createReadStream(path)
      .pipe(png)
      .on('parsed', () => resolve(png))
      .on('error', reject)
  })
}

/** Write a PNG buffer back to disk. */
function writePng(png: PNG, path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    png.pack().pipe(createWriteStream(path)).on('finish', resolve).on('error', reject)
  })
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi)
}

/**
 * Crop `srcPath` to the given bounds (in logical CSS pixels). Pads, scales,
 * clamps to image dims, writes to `destPath`, and returns the destination
 * path. Returns null if bounds resolve to a zero-area rectangle.
 */
export async function cropPng(
  srcPath: string,
  bounds: CropBounds,
  destPath: string,
  opts: CropOptions = {},
): Promise<string | null> {
  const padding = opts.padding ?? 16
  const scale = opts.scale ?? 1

  const src = await loadPng(srcPath)

  // Convert logical → image pixels, then pad and clamp to the image.
  const x0 = Math.floor(clamp((bounds.x - padding) * scale, 0, src.width))
  const y0 = Math.floor(clamp((bounds.y - padding) * scale, 0, src.height))
  const x1 = Math.ceil(clamp((bounds.x + bounds.width + padding) * scale, 0, src.width))
  const y1 = Math.ceil(clamp((bounds.y + bounds.height + padding) * scale, 0, src.height))
  const cropW = x1 - x0
  const cropH = y1 - y0
  if (cropW <= 0 || cropH <= 0) return null

  const out = new PNG({ width: cropW, height: cropH })
  // pngjs.bitblt copies pixel rectangles between PNGs.
  src.bitblt(out, x0, y0, cropW, cropH, 0, 0)

  await mkdir(dirname(destPath), { recursive: true })
  await writePng(out, destPath)
  return destPath
}
