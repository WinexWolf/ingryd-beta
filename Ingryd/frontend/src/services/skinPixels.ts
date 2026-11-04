/**
 * Simple colour analysis for side-angle skin photos. Runs entirely in the browser, no network, no model.
 *
 * It does NOT diagnose anything. It looks for three things that show up as colour differences from the
 * surrounding skin:
 *   - redness      broad patches redder than the skin around them
 *   - blemishes    small, compact, strongly red spots (what acne looks like in a photo)
 *   - dark spots   small spots darker than the skin around them, but not red
 * Clogged pores and fine texture need a sharp close-up, so they are deliberately not attempted.
 *
 * Everything is relative to the local skin tone (a blurred baseline), so a lighting gradient or a naturally
 * rosy cheek does not count as a finding; only change against the nearby skin does.
 */

export type Kind = 'redness' | 'blemishes' | 'dark_spots'
export interface Box { x: number; y: number; w: number; h: number }          // fractions 0-1 of the image
export interface Finding { kind: Kind; box: Box; strength: number; place: string }
export type Level = 'none' | 'mild' | 'noticeable'
export interface SkinResult {
  skinFound: boolean
  skinShare: number                        // share of the photo that looks like skin
  findings: Finding[]
  summary: Record<Kind, { level: Level; count: number }>
  warnings: string[]                       // photo-quality problems that make the result less reliable
}

const NONE = { level: 'none' as Level, count: 0 }
const EMPTY = (warnings: string[], skinShare = 0): SkinResult => ({
  skinFound: false, skinShare, findings: [], warnings,
  summary: { redness: { ...NONE }, blemishes: { ...NONE }, dark_spots: { ...NONE } },
})

// ---- colour helpers -------------------------------------------------------------------------------------

function toLab(r: number, g: number, b: number): [number, number, number] {
  const lin = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) }
  const R = lin(r), G = lin(g), B = lin(b)
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047
  const Y = 0.2126 * R + 0.7152 * G + 0.0722 * B
  const Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const fx = f(X), fy = f(Y), fz = f(Z)
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

function isSkin(r: number, g: number, b: number): boolean {
  const y = 0.299 * r + 0.587 * g + 0.114 * b
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b
  return y > 40 && y < 245 && cb >= 77 && cb <= 127 && cr >= 133 && cr <= 175 && r > g && r > b
}

/** Blur of `v` over the pixels where `m` is 1 only (normalised box filter via integral images). */
function maskedBlur(v: Float32Array, m: Uint8Array, w: number, h: number, radius: number): Float32Array {
  const W = w + 1
  const sv = new Float64Array(W * (h + 1)), sm = new Float64Array(W * (h + 1))
  for (let y = 0; y < h; y++) {
    let rv = 0, rm = 0
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      rv += m[i] ? v[i] : 0
      rm += m[i]
      sv[(y + 1) * W + x + 1] = sv[y * W + x + 1] + rv
      sm[(y + 1) * W + x + 1] = sm[y * W + x + 1] + rm
    }
  }
  const out = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - radius), y1 = Math.min(h, y + radius + 1)
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - radius), x1 = Math.min(w, x + radius + 1)
      const cnt = sm[y1 * W + x1] - sm[y0 * W + x1] - sm[y1 * W + x0] + sm[y0 * W + x0]
      const sum = sv[y1 * W + x1] - sv[y0 * W + x1] - sv[y1 * W + x0] + sv[y0 * W + x0]
      out[y * w + x] = cnt > 0 ? sum / cnt : 0
    }
  }
  return out
}

interface Blob { area: number; x0: number; y0: number; x1: number; y1: number; peak: number; sum: number }

/** 4-connected components of `flag`; returns blobs with their bounding boxes. `val` scores each pixel. */
function components(flag: Uint8Array, val: Float32Array, w: number, h: number, labels?: Int32Array): Blob[] {
  const seen = new Uint8Array(w * h)
  const blobs: Blob[] = []
  const stack: number[] = []
  for (let s = 0; s < w * h; s++) {
    if (!flag[s] || seen[s]) continue
    const b: Blob = { area: 0, x0: w, y0: h, x1: 0, y1: 0, peak: 0, sum: 0 }
    stack.push(s); seen[s] = 1
    while (stack.length) {
      const i = stack.pop()!
      const x = i % w, y = (i - x) / w
      b.area++; b.sum += val[i]
      if (labels) labels[i] = blobs.length + 1
      if (val[i] > b.peak) b.peak = val[i]
      if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x
      if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y
      if (x > 0 && flag[i - 1] && !seen[i - 1]) { seen[i - 1] = 1; stack.push(i - 1) }
      if (x < w - 1 && flag[i + 1] && !seen[i + 1]) { seen[i + 1] = 1; stack.push(i + 1) }
      if (y > 0 && flag[i - w] && !seen[i - w]) { seen[i - w] = 1; stack.push(i - w) }
      if (y < h - 1 && flag[i + w] && !seen[i + w]) { seen[i + w] = 1; stack.push(i + w) }
    }
    blobs.push(b)
  }
  return blobs
}

// ---- main -----------------------------------------------------------------------------------------------

/** Tuning constants, in Lab units / fractions of the skin area. Kept together so they can be adjusted on real photos. */
export const TUNING = {
  minSkinShare: 0.06,
  redDelta: 5.5,          // a* above local skin for a "redness" patch
  blemishDelta: 9,        // a* above local skin for a blemish core
  darkDelta: 9,           // L* below local skin for a dark spot
  darkMaxRed: 5,          // a dark spot must not itself be red
  blemishAreaMin: 0.0004, // as a share of skin area
  blemishAreaMax: 0.012,
  spotAreaMin: 0.0003,
  spotAreaMax: 0.008,
  rednessAreaMin: 0.015,
  fillMin: 0.45,          // blob area / bounding-box area; rejects thin streaks (hair edges, creases)
}

/**
 * @param rgba   RGBA pixels (e.g. canvas getImageData), ideally downscaled so the width is about 200-300.
 * @param within optional face box (fractions); the analysis is limited to it when given.
 * @param allowed optional per-pixel mask (1 = analyse), e.g. from the face mesh; overrides the box for share maths.
 */
export function analyzeSkin(rgba: Uint8ClampedArray, w: number, h: number, within?: Box, allowed?: Uint8Array): SkinResult {
  const n = w * h
  const inBox = (x: number, y: number) =>
    !within || (x >= within.x * w && x <= (within.x + within.w) * w && y >= within.y * h && y <= (within.y + within.h) * h)

  // 1. skin mask, keeping only the largest connected skin region (drops skin-coloured background bits)
  const raw = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const x = i % w, y = (i - x) / w
    if ((!allowed || allowed[i]) && inBox(x, y) && isSkin(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2])) raw[i] = 1
  }
  const zero = new Float32Array(n)
  const labels = new Int32Array(n)
  const regions = components(raw, zero, w, h, labels)
  if (regions.length === 0) return EMPTY(['We could not find enough skin in this photo.'])
  let mainIdx = 0
  regions.forEach((r, i) => { if (r.area > regions[mainIdx].area) mainIdx = i })
  const main = regions[mainIdx]
  const mask = new Uint8Array(n)
  for (let i = 0; i < n; i++) if (labels[i] === mainIdx + 1) mask[i] = 1
  const sx0 = main.x0, sx1 = main.x1, sy0 = main.y0, sy1 = main.y1
  // Pull the mask in from its edges: lips, eyes, hair and the face outline create colour jumps that are not skin issues.
  const inner = new Uint8Array(n)
  const mf = Float32Array.from(mask)
  const frac = maskedBlur(mf, new Uint8Array(n).fill(1), w, h, 3)
  let skinCount = 0
  for (let i = 0; i < n; i++) if (mask[i] && frac[i] > 0.999) { inner[i] = 1; skinCount++ }
  mask.set(inner)
  const skinShare = skinCount / (allowed ? Math.max(1, allowed.reduce((a, v) => a + v, 0)) : within ? Math.max(1, within.w * within.h * n) : n)
  if (skinShare < TUNING.minSkinShare) return EMPTY(['We could not find enough skin in this photo. Move closer and fill the frame with your cheek and jaw.'], skinShare)

  // 2. Lab values, plus a blurred local baseline so lighting gradients and natural tone cancel out
  const L = new Float32Array(n), A = new Float32Array(n)
  let lSum = 0
  for (let i = 0; i < n; i++) {
    if (!mask[i]) continue
    const [l, a] = toLab(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2])
    L[i] = l; A[i] = a; lSum += l
  }
  const radius = Math.max(6, Math.round(Math.min(sx1 - sx0, sy1 - sy0) / 6))
  const Lbg = maskedBlur(L, mask, w, h, radius), Abg = maskedBlur(A, mask, w, h, radius)
  const warnings: string[] = []
  const meanL = lSum / skinCount
  if (meanL < 30) warnings.push('This photo is dark, so results will be less reliable. Face a window or a lamp.')
  if (meanL > 88) warnings.push('This photo is very bright or washed out, so results will be less reliable.')

  // 3. per-pixel differences from the nearby skin (skin pixels only; eyes, brows and hair are already excluded)
  const dA = new Float32Array(n), dL = new Float32Array(n)
  const red = new Uint8Array(n), core = new Uint8Array(n), dark = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    if (!mask[i]) continue
    dA[i] = A[i] - Abg[i]; dL[i] = Lbg[i] - L[i]
    if (dA[i] > TUNING.redDelta) red[i] = 1
    if (dA[i] > TUNING.blemishDelta) core[i] = 1
    if (dL[i] > TUNING.darkDelta && dA[i] < TUNING.darkMaxRed) dark[i] = 1
  }

  const findings: Finding[] = []
  const bw = sx1 - sx0 + 1, bh = sy1 - sy0 + 1
  const place = (cy: number) => {
    const t = (cy - sy0) / bh
    return t < 0.3 ? 'upper cheek / temple' : t < 0.75 ? 'cheek' : 'jaw / chin'
  }
  const push = (kind: Kind, b: Blob, strength: number) => findings.push({
    kind, strength: Math.min(1, strength), place: place((b.y0 + b.y1) / 2),
    box: { x: b.x0 / w, y: b.y0 / h, w: (b.x1 - b.x0 + 1) / w, h: (b.y1 - b.y0 + 1) / h },
  })
  const fill = (b: Blob) => b.area / ((b.x1 - b.x0 + 1) * (b.y1 - b.y0 + 1))

  // blemishes: compact, strongly red cores
  for (const b of components(core, dA, w, h)) {
    const a = b.area / skinCount
    if (a >= TUNING.blemishAreaMin && a <= TUNING.blemishAreaMax && fill(b) >= TUNING.fillMin) push('blemishes', b, b.peak / 25)
  }
  // redness: broad patches (blemish cores inside them are reported separately above)
  for (const b of components(red, dA, w, h)) {
    if (b.area / skinCount >= TUNING.rednessAreaMin) push('redness', b, b.sum / b.area / 14)
  }
  // dark spots
  for (const b of components(dark, dL, w, h)) {
    const a = b.area / skinCount
    if (a >= TUNING.spotAreaMin && a <= TUNING.spotAreaMax && fill(b) >= TUNING.fillMin) push('dark_spots', b, b.peak / 25)
  }

  findings.sort((a, b) => b.strength - a.strength)
  const top = findings.slice(0, 14)
  const level = (kind: Kind, mild: number, high: number): { level: Level; count: number } => {
    const count = findings.filter((f) => f.kind === kind).length
    return { count, level: count === 0 ? 'none' : count < high ? (count >= mild ? 'mild' : 'none') : 'noticeable' }
  }
  const rednessShare = findings.filter((f) => f.kind === 'redness').reduce((s, f) => s + f.box.w * f.box.h, 0)
  const redLevel: Level = rednessShare === 0 ? 'none' : rednessShare < 0.06 ? 'mild' : 'noticeable'
  return {
    skinFound: true, skinShare, findings: top, warnings,
    summary: {
      redness: { level: redLevel, count: findings.filter((f) => f.kind === 'redness').length },
      blemishes: level('blemishes', 1, 5),
      dark_spots: level('dark_spots', 2, 6),
    },
  }
}

/** Reads a photo into downscaled pixels (width ~240). Browser only. */
export function pixelsFromImage(img: HTMLImageElement, width = 240): { data: Uint8ClampedArray; w: number; h: number } {
  const scale = width / img.naturalWidth
  const w = width, h = Math.max(1, Math.round(img.naturalHeight * scale))
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, w, h)
  return { data: ctx.getImageData(0, 0, w, h).data, w, h }
}
