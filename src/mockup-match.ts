/**
 * Mockup-to-reality matching pipeline.
 * Compares a design mockup PNG against a live rendered web page using SSIM + pixelmatch.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'
import { EngineDriver } from './engine/driver.js'
import type { ViewportConfig } from './engine/cdp/emulation.js'
import { computeSSIM, type SSIMResult } from './ssim.js'

export interface Viewport {
  width: number
  height: number
}

export interface MockupMatchOptions {
  /** Path to mockup PNG file */
  mockupPath: string
  /** URL of live page to compare against */
  url: string
  /** CSS selector to crop live page to this element */
  selector?: string
  /** Auto-mask dynamic content (timestamps, timers, etc.) */
  maskDynamic?: boolean
  /** Override viewport — defaults to mockup dimensions */
  viewport?: Viewport
  /** Run browser headless (default: true) */
  headless?: boolean
}

export interface PixelDiffResult {
  count: number
  percentage: number
  diffImage: Buffer
}

export interface MockupMatchResult {
  /** Overall SSIM score and verdict */
  ssim: SSIMResult
  /** pixelmatch pixel-level diff */
  pixelDiff: PixelDiffResult
  /** Mockup file dimensions */
  mockupDimensions: { width: number; height: number }
  /** Live screenshot dimensions */
  liveDimensions: { width: number; height: number }
  /** Regions that were auto-masked */
  maskedRegions: string[]
}

/**
 * Read a PNG file and return parsed image data.
 */
async function readPng(filePath: string): Promise<{ data: Buffer; width: number; height: number }> {
  const buffer = await readFile(filePath)
  const png = PNG.sync.read(buffer)
  return { data: png.data, width: png.width, height: png.height }
}

/**
 * Decode a PNG Buffer (screenshot) into pixel data.
 */
function decodePng(buffer: Buffer): { data: Buffer; width: number; height: number } {
  const png = PNG.sync.read(buffer)
  return { data: png.data, width: png.width, height: png.height }
}

/**
 * Resize image pixel data to target dimensions using nearest-neighbor sampling.
 * Used when mockup and live screenshot have minor dimension differences.
 */
function resizeNearest(
  src: Buffer,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): Buffer {
  const dst = Buffer.allocUnsafe(dstW * dstH * 4)
  const scaleX = srcW / dstW
  const scaleY = srcH / dstH

  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      const srcX = Math.min(Math.floor(x * scaleX), srcW - 1)
      const srcY = Math.min(Math.floor(y * scaleY), srcH - 1)
      const srcIdx = (srcY * srcW + srcX) * 4
      const dstIdx = (y * dstW + x) * 4
      dst[dstIdx] = src[srcIdx]
      dst[dstIdx + 1] = src[srcIdx + 1]
      dst[dstIdx + 2] = src[srcIdx + 2]
      dst[dstIdx + 3] = src[srcIdx + 3]
    }
  }
  return dst
}

/**
 * Paint a rectangular region in a pixel buffer with a solid gray color.
 * Used for masking dynamic regions before comparison.
 */
function paintRegionGray(
  data: Buffer,
  width: number,
  x: number,
  y: number,
  regionW: number,
  regionH: number,
): void {
  const gray = 128
  for (let row = y; row < y + regionH; row++) {
    for (let col = x; col < x + regionW; col++) {
      const idx = (row * width + col) * 4
      if (idx + 3 < data.length) {
        data[idx] = gray
        data[idx + 1] = gray
        data[idx + 2] = gray
        data[idx + 3] = 255
      }
    }
  }
}

/**
 * Match a design mockup against a live page.
 *
 * Pipeline:
 * 1. Read mockup PNG — get dimensions and pixel data
 * 2. Launch Chrome with viewport matching mockup dimensions
 * 3. Navigate to URL and wait for render stability
 * 4. If selector provided, clip screenshot to that element
 * 5. If maskDynamic, query AX tree for time-related elements and mask them
 * 6. Compute SSIM + pixelmatch diff
 * 7. Return complete result
 */
export async function matchMockup(options: MockupMatchOptions): Promise<MockupMatchResult> {
  const {
    mockupPath,
    url,
    selector,
    maskDynamic = false,
    headless = true,
  } = options

  // Step 1: Read mockup
  let mockup = await readPng(mockupPath)

  // Viewport: use mockup dimensions unless overridden
  const viewport: ViewportConfig = {
    width: options.viewport?.width ?? mockup.width,
    height: options.viewport?.height ?? mockup.height,
    deviceScaleFactor: 1,
    mobile: false,
  }

  // Step 2: Launch browser with normalization flags
  const driver = new EngineDriver()
  try {
    await driver.launch({
      headless,
      normalize: true,
      viewport,
    })

    // Step 3: Navigate and wait for stability
    await driver.navigate(url, { waitFor: 'stable', timeout: 15000 })

    // Step 4: Screenshot — full page or element clip
    let screenshotBuffer: Buffer

    if (selector) {
      // Find element using DOM query, then clip screenshot to its bounds
      const nodeId = await driver.querySelector(selector)
      if (nodeId === null) {
        throw new Error(`Selector not found: ${selector}`)
      }

      // Use runtime to get bounding rect
      const bounds = await driver.evaluate(
        `(sel => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; })`,
        selector,
      ) as { x: number; y: number; width: number; height: number } | null

      if (!bounds || bounds.width === 0 || bounds.height === 0) {
        throw new Error(`Selector "${selector}" has zero bounds or is not visible`)
      }

      screenshotBuffer = await driver.screenshot({
        clip: {
          x: Math.round(bounds.x),
          y: Math.round(bounds.y),
          width: Math.round(bounds.width),
          height: Math.round(bounds.height),
        },
      })
    } else {
      screenshotBuffer = await driver.screenshot()
    }

    // Decode live screenshot
    let live = decodePng(screenshotBuffer)

    // Step 5: Auto-mask dynamic regions
    const maskedRegions: string[] = []

    if (maskDynamic) {
      const dynamicRegions = await findDynamicRegions(driver)

      if (dynamicRegions.length > 0) {
        // Clone buffers before painting (we need to paint both mockup and live the same)
        const mockupData = Buffer.from(mockup.data)
        const liveData = Buffer.from(live.data)

        for (const region of dynamicRegions) {
          // Scale region bounds if dimensions differ
          const scaleX = live.width / viewport.width
          const scaleY = live.height / viewport.height
          const liveX = Math.round(region.x * scaleX)
          const liveY = Math.round(region.y * scaleY)
          const liveW = Math.round(region.width * scaleX)
          const liveH = Math.round(region.height * scaleY)

          // Scale to mockup coords too
          const mockX = Math.round(region.x * (mockup.width / viewport.width))
          const mockY = Math.round(region.y * (mockup.height / viewport.height))
          const mockW = Math.round(region.width * (mockup.width / viewport.width))
          const mockH = Math.round(region.height * (mockup.height / viewport.height))

          paintRegionGray(liveData, live.width, liveX, liveY, liveW, liveH)
          paintRegionGray(mockupData, mockup.width, mockX, mockY, mockW, mockH)
          maskedRegions.push(region.label)
        }

        // Replace data with masked versions (create new objects, don't mutate originals)
        live = { data: liveData, width: live.width, height: live.height }
        mockup = { data: mockupData, width: mockup.width, height: mockup.height }
      }
    }

    // Step 6: Align dimensions for comparison
    // If sizes differ, resize live to mockup dimensions (mockup is the reference)
    let compareData1 = mockup.data
    let compareData2 = live.data
    let compareWidth = mockup.width
    let compareHeight = mockup.height

    if (live.width !== mockup.width || live.height !== mockup.height) {
      compareData2 = resizeNearest(live.data, live.width, live.height, mockup.width, mockup.height)
    }

    // Step 7a: Compute SSIM
    const ssimResult = computeSSIM(
      { data: compareData1, width: compareWidth, height: compareHeight },
      { data: compareData2, width: compareWidth, height: compareHeight },
    )

    // Step 7b: Compute pixelmatch diff
    const diffPng = new PNG({ width: compareWidth, height: compareHeight })
    const diffPixelCount = pixelmatch(
      compareData1,
      compareData2,
      diffPng.data,
      compareWidth,
      compareHeight,
      {
        threshold: 0.1,
        includeAA: false,
        alpha: 0.1,
        diffColor: [255, 0, 0],
      },
    )

    const totalPixels = compareWidth * compareHeight
    const diffImage = PNG.sync.write(diffPng)

    return {
      ssim: ssimResult,
      pixelDiff: {
        count: diffPixelCount,
        percentage: Math.round((diffPixelCount / totalPixels) * 10000) / 100,
        diffImage,
      },
      mockupDimensions: { width: mockup.width, height: mockup.height },
      liveDimensions: { width: live.width, height: live.height },
      maskedRegions,
    }
  } finally {
    await driver.close()
  }
}

// ─── Dynamic region detection ─────────────────────────────────────────────────

interface DynamicRegion {
  x: number
  y: number
  width: number
  height: number
  label: string
}

/**
 * Query the AX tree for elements that are likely to show dynamic content
 * (timestamps, timers, clocks, ads, live regions).
 * Returns their bounding rects for masking.
 */
async function findDynamicRegions(driver: EngineDriver): Promise<DynamicRegion[]> {
  const regions: DynamicRegion[] = []

  // Build a combined selector for dynamic elements
  const selectors: string[] = [
    '[role="timer"]',
    '[role="status"]',
    '[role="log"]',
    '[role="marquee"]',
    '[role="alert"]',
    'time[datetime]',
    '[data-timestamp]',
    '[data-time]',
    '[data-date]',
    '.timestamp',
    '.ad',
    '.advertisement',
    '.ad-banner',
    '.sponsored',
    'ins.adsbygoogle',
  ]

  for (const sel of selectors) {
    try {
      const boundsJson = await driver.evaluate(
        `(sel => {
          const els = document.querySelectorAll(sel);
          const results = [];
          for (const el of els) {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.height > 0) {
              results.push({ x: r.left, y: r.top, width: r.width, height: r.height, label: el.getAttribute('role') || el.className || sel });
            }
          }
          return JSON.stringify(results);
        })`,
        sel,
      ) as string

      if (boundsJson) {
        const parsed = JSON.parse(boundsJson) as Array<{ x: number; y: number; width: number; height: number; label: string }>
        for (const item of parsed) {
          // Avoid duplicate regions (same position)
          const isDuplicate = regions.some(
            (r) => Math.abs(r.x - item.x) < 2 && Math.abs(r.y - item.y) < 2,
          )
          if (!isDuplicate) {
            const labelStr = typeof item.label === 'string' ? item.label.split(' ')[0] : sel
            regions.push({ x: item.x, y: item.y, width: item.width, height: item.height, label: labelStr })
          }
        }
      }
    } catch {
      // Best-effort — skip selectors that fail
    }
  }

  return regions
}

/**
 * Save a diff image Buffer to a file path.
 * Convenience utility for CLI usage.
 */
export async function saveDiffImage(diffImage: Buffer, outputPath: string): Promise<void> {
  await writeFile(outputPath, diffImage)
}
