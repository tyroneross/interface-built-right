/**
 * Pure TypeScript SSIM (Structural Similarity Index) implementation.
 * Zero dependencies — computes perceptual image similarity on a 0.0–1.0 scale.
 *
 * Algorithm: SSIM(x,y) = l(x,y) * c(x,y) * s(x,y)
 *   l = luminance comparison
 *   c = contrast comparison
 *   s = structure comparison
 *
 * Reference: Wang et al., "Image quality assessment: from error visibility
 * to structural similarity", IEEE TIP 2004.
 */

// Stability constants (Wang et al. recommended values)
const C1 = (0.01 * 255) ** 2  // 6.5025
const C2 = (0.03 * 255) ** 2  // 58.5225

export interface SSIMResult {
  /** 0.0 = completely different, 1.0 = identical */
  score: number
  /** >0.85 = pass, 0.70–0.85 = review, <0.70 = fail */
  verdict: 'pass' | 'review' | 'fail'
}

export interface ImageInput {
  data: Uint8Array | Buffer
  width: number
  height: number
}

export interface SSIMOptions {
  /** Sliding window size. Default: 8 */
  windowSize?: number
}

/**
 * Convert RGBA pixel buffer to luminance (grayscale) channel.
 * Y = 0.299*R + 0.587*G + 0.114*B  (ITU-R BT.601)
 */
function toLuminance(data: Uint8Array | Buffer, width: number, height: number): Float64Array {
  const pixels = width * height
  const luma = new Float64Array(pixels)
  for (let i = 0; i < pixels; i++) {
    const offset = i * 4
    luma[i] = 0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2]
  }
  return luma
}

/**
 * Extract a rectangular window of pixels from a flat luma buffer.
 */
function extractWindow(
  luma: Float64Array,
  imgWidth: number,
  x: number,
  y: number,
  windowSize: number,
): Float64Array {
  const win = new Float64Array(windowSize * windowSize)
  let idx = 0
  for (let row = 0; row < windowSize; row++) {
    const rowOffset = (y + row) * imgWidth + x
    for (let col = 0; col < windowSize; col++) {
      win[idx++] = luma[rowOffset + col]
    }
  }
  return win
}

/**
 * Compute mean of an array.
 */
function mean(arr: Float64Array): number {
  let sum = 0
  for (let i = 0; i < arr.length; i++) sum += arr[i]
  return sum / arr.length
}

/**
 * Compute variance and cross-covariance between two arrays given their means.
 * Returns { varX, varY, covXY }
 */
function statsWithMeans(
  x: Float64Array,
  y: Float64Array,
  meanX: number,
  meanY: number,
): { varX: number; varY: number; covXY: number } {
  const n = x.length
  let varX = 0
  let varY = 0
  let covXY = 0
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX
    const dy = y[i] - meanY
    varX += dx * dx
    varY += dy * dy
    covXY += dx * dy
  }
  // Use population variance (n, not n-1) — consistent with the original paper
  return { varX: varX / n, varY: varY / n, covXY: covXY / n }
}

/**
 * Compute SSIM for a single window pair.
 */
function windowSSIM(winX: Float64Array, winY: Float64Array): number {
  const muX = mean(winX)
  const muY = mean(winY)
  const { varX, varY, covXY } = statsWithMeans(winX, winY, muX, muY)

  const muX2 = muX * muX
  const muY2 = muY * muY
  const muXY = muX * muY

  const numerator = (2 * muXY + C1) * (2 * covXY + C2)
  const denominator = (muX2 + muY2 + C1) * (varX + varY + C2)

  return numerator / denominator
}

/**
 * Compute the Structural Similarity Index between two images.
 *
 * Both images must have the same dimensions. Pixel data is expected
 * as RGBA (4 bytes per pixel), as produced by pngjs or the Canvas API.
 *
 * @param img1 - Reference image
 * @param img2 - Comparison image
 * @param options - Algorithm options (windowSize, default 8)
 * @returns SSIMResult with score (0–1) and verdict
 */
export function computeSSIM(
  img1: ImageInput,
  img2: ImageInput,
  options: SSIMOptions = {},
): SSIMResult {
  const windowSize = options.windowSize ?? 8

  if (img1.width !== img2.width || img1.height !== img2.height) {
    throw new Error(
      `SSIM requires equal dimensions. `
      + `img1: ${img1.width}x${img1.height}, img2: ${img2.width}x${img2.height}`,
    )
  }

  const { width, height } = img1

  if (width < windowSize || height < windowSize) {
    // Image smaller than window — compare means directly as a degenerate case
    const luma1 = toLuminance(img1.data, width, height)
    const luma2 = toLuminance(img2.data, width, height)
    const score = Math.max(0, Math.min(1, windowSSIM(luma1, luma2)))
    return { score, verdict: scoreToVerdict(score) }
  }

  const luma1 = toLuminance(img1.data, width, height)
  const luma2 = toLuminance(img2.data, width, height)

  // Slide the window across valid positions (no padding)
  const maxX = width - windowSize
  const maxY = height - windowSize

  let totalSSIM = 0
  let windowCount = 0

  // Step by windowSize/2 for overlapping windows — more accurate than non-overlapping
  const step = Math.max(1, Math.floor(windowSize / 2))

  for (let y = 0; y <= maxY; y += step) {
    for (let x = 0; x <= maxX; x += step) {
      const win1 = extractWindow(luma1, width, x, y, windowSize)
      const win2 = extractWindow(luma2, width, x, y, windowSize)
      totalSSIM += windowSSIM(win1, win2)
      windowCount++
    }
  }

  if (windowCount === 0) {
    return { score: 1, verdict: 'pass' }
  }

  const score = Math.max(0, Math.min(1, totalSSIM / windowCount))
  return { score, verdict: scoreToVerdict(score) }
}

function scoreToVerdict(score: number): 'pass' | 'review' | 'fail' {
  if (score > 0.85) return 'pass'
  if (score >= 0.70) return 'review'
  return 'fail'
}
