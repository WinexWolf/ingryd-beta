/** Pre-flight check for skin-scan photos. Runs entirely in the browser (the photo is not uploaded for this),
 *  so a cat, a group shot or an empty room is caught before it spends any YouCam units.
 *
 *  Design rules:
 *  - "block" = we are confident the photo can't give a meaningful skin read (several faces, face far too small).
 *  - "nofaces" = a block the person may override: any face detector misses some real faces (dim light, angles,
 *    skin tones it saw less of in training), and we must never lock a real user out.
 *  - "warn" = analysis will run but may be less reliable; the person decides.
 *  - If the detector can't load (offline, old browser) the check is skipped, never failed. */

export type View = 'front' | 'left' | 'right'
export interface CheckOptions {
  view?: View            // which photo this is (default front): decides the expected head turn
  mirrored?: boolean     // true for a mirrored selfie frame: lets us check the head turned the right way
  fast?: boolean         // live-camera mode: smaller detector input, same rules
}

export type Severity = 'block' | 'nofaces' | 'warn'
export interface PhotoIssue { code: string; severity: Severity; message: string }
export interface PhotoCheck {
  checked: boolean          // false when the detector was unavailable
  faces: number
  issues: PhotoIssue[]
  blocked: boolean          // has a 'block' or 'nofaces' issue
  overridable: boolean      // blocked only by 'nofaces'
  /** 0 = nose at the left jaw edge, 0.5 = facing the camera, 1 = nose at the right jaw edge (image coordinates). */
  yaw?: number
  /** Face box as fractions of the photo (0-1). Used to crop the photo tightly before analysis. */
  box?: { x: number; y: number; w: number; h: number }
  stats?: { facePct: number; brightness: number; sharpness: number } // for tuning/diagnostics
}

export const SKIPPED: PhotoCheck = { checked: false, faces: 0, issues: [], blocked: false, overridable: false }

type FaceApi = typeof import('@vladmandic/face-api')
let loading: Promise<FaceApi | null> | null = null

/** Lazy-loads the detector (~200 KB model + library) the first time it's needed. */
export function loadDetector(): Promise<FaceApi | null> {
  if (!loading) {
    loading = (async () => {
      try {
        const faceapi = await import('@vladmandic/face-api')
        await faceapi.nets.tinyFaceDetector.loadFromUri(`${import.meta.env.BASE_URL}models`)
        await faceapi.nets.faceLandmark68TinyNet.loadFromUri(`${import.meta.env.BASE_URL}models`)
        return faceapi
      } catch (e) {
        console.warn('Face check unavailable, skipping:', e)
        return null
      }
    })()
  }
  return loading
}

type Source = HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
const sizeOf = (s: Source) => s instanceof HTMLVideoElement ? { w: s.videoWidth, h: s.videoHeight } :
  s instanceof HTMLImageElement ? { w: s.naturalWidth, h: s.naturalHeight } : { w: s.width, h: s.height }

/** Draws the source into a small canvas for analysis (max 640px wide). */
function toCanvas(src: Source, maxW = 640): HTMLCanvasElement {
  const { w, h } = sizeOf(src)
  const scale = Math.min(1, maxW / Math.max(1, w))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w * scale)); c.height = Math.max(1, Math.round(h * scale))
  c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height)
  return c
}

/** Mean brightness (0-255) and sharpness (variance of the Laplacian) of a region. */
function lumaStats(c: HTMLCanvasElement, box?: { x: number; y: number; w: number; h: number }) {
  const x = Math.max(0, Math.round(box?.x ?? 0)), y = Math.max(0, Math.round(box?.y ?? 0))
  const w = Math.max(3, Math.min(c.width - x, Math.round(box?.w ?? c.width)))
  const h = Math.max(3, Math.min(c.height - y, Math.round(box?.h ?? c.height)))
  const d = c.getContext('2d')!.getImageData(x, y, w, h).data
  const g = new Float32Array(w * h)
  let sum = 0
  for (let i = 0; i < w * h; i++) { const v = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]; g[i] = v; sum += v }
  const mean = sum / (w * h)
  let m = 0, m2 = 0, n = 0
  for (let j = 1; j < h - 1; j++) for (let i = 1; i < w - 1; i++) {
    const k = j * w + i
    const lap = g[k - 1] + g[k + 1] + g[k - w] + g[k + w] - 4 * g[k]
    m += lap; m2 += lap * lap; n++
  }
  const sharp = n ? m2 / n - (m / n) ** 2 : 0
  return { mean, sharp }
}

type Det = Awaited<ReturnType<ReturnType<FaceApi['detectAllFaces']>['withFaceLandmarks']>>[number]

/** The tiny detector is very sensitive to its input size: the same clear face can score 0.94 at one size and
 *  nothing at the next. So we try several sizes and merge the results (a face found at any size counts once). */
async function detectMultiScale(faceapi: FaceApi, c: HTMLCanvasElement, fast: boolean): Promise<Det[]> {
  const sizes = fast ? [320, 512] : [320, 416, 512, 608]
  const all: Det[] = []
  for (const inputSize of sizes) {
    all.push(...await faceapi.detectAllFaces(c, new faceapi.TinyFaceDetectorOptions({ inputSize, scoreThreshold: 0.5 })).withFaceLandmarks(true))
  }
  all.sort((a, b) => b.detection.score - a.detection.score)
  const kept: Det[] = []
  for (const d of all) {
    const b = d.detection.box
    const dup = kept.some((k) => {
      const o = k.detection.box
      const iw = Math.min(b.right, o.right) - Math.max(b.left, o.left), ih = Math.min(b.bottom, o.bottom) - Math.max(b.top, o.top)
      return iw > 0 && ih > 0 && (iw * ih) / Math.min(b.width * b.height, o.width * o.height) > 0.5
    })
    if (!dup) kept.push(d)
  }
  return kept
}

export async function checkPhoto(src: Source, opts: CheckOptions = {}): Promise<PhotoCheck> {
  const view: View = opts.view ?? 'front'
  const faceapi = await loadDetector()
  if (!faceapi) return SKIPPED
  const { w, h } = sizeOf(src)
  if (!w || !h) return SKIPPED

  const c = toCanvas(src)
  const dets = await detectMultiScale(faceapi, c, !!opts.fast)
  dets.sort((a, b) => b.detection.box.width - a.detection.box.width)
  const boxes = dets.map((d) => d.detection.box)
  // Ignore tiny faces far behind the main subject (a poster, a bystander): only comparable-size faces count.
  const main = boxes[0]
  const faces = main ? boxes.filter((b) => b.width >= main.width * 0.45) : []
  const issues: PhotoIssue[] = []
  let stats: PhotoCheck['stats']
  let yaw: number | undefined
  let box: PhotoCheck['box']

  if (faces.length === 0) {
    issues.push({ code: 'no-face', severity: 'nofaces', message: "We couldn't find a face in this photo. Use a sharp, well-lit, front-facing photo of your own face." })
  } else if (faces.length > 1) {
    issues.push({ code: 'many-faces', severity: 'block', message: `We found ${faces.length} faces. Skin analysis needs a photo of just one person — yours.` })
  } else {
    const f = faces[0]
    const share = f.width / c.width
    box = { x: f.x / c.width, y: f.y / c.height, w: f.width / c.width, h: f.height / c.height }
    if (share < 0.15) issues.push({ code: 'too-far', severity: 'block', message: 'Your face is too small in this photo. Move closer so it fills the frame.' })
    else if (share < 0.28) issues.push({ code: 'far', severity: 'warn', message: 'Your face is fairly small in the frame — move a bit closer for a better read.' })
    const cx = (f.x + f.width / 2) / c.width, cy = (f.y + f.height / 2) / c.height
    const cut = f.x < -f.width * 0.08 || f.y < -f.height * 0.08 || f.x + f.width > c.width + f.width * 0.08 || f.y + f.height > c.height + f.height * 0.08
    if (cut) issues.push({ code: 'cut-off', severity: 'warn', message: 'Part of your face is cut off. Keep your whole face inside the frame.' })
    else if (Math.abs(cx - 0.5) > 0.3 || Math.abs(cy - 0.5) > 0.3) issues.push({ code: 'off-center', severity: 'warn', message: 'Your face is off to one side. Center it in the frame.' })

    // Head turn from the nose tip's position between the two jaw edges (landmarks 30, 0, 16).
    const pts = dets[0].landmarks.positions
    const span = pts[16].x - pts[0].x
    if (span > 1) yaw = Math.max(0, Math.min(1, (pts[30].x - pts[0].x) / span))
    if (yaw !== undefined) addPoseIssues(issues, view, yaw, opts.mirrored)

    const { mean, sharp: rawSharp } = lumaStats(c, { x: f.x, y: f.y, w: f.width, h: f.height })
    const sharp = rawSharp / Math.max(0.25, (mean / 128) ** 2) // darker photos have lower raw contrast; compare fairly
    stats = { facePct: Math.round(share * 100), brightness: Math.round(mean), sharpness: Math.round(sharp) }
    if (mean < 55) issues.push({ code: 'dark', severity: 'warn', message: 'Your face looks dark. Face a window or turn on a light, then retake.' })
    else if (mean > 215) issues.push({ code: 'bright', severity: 'warn', message: 'Your face looks washed out. Avoid direct flash or harsh light.' })
    if (sharp < 8) issues.push({ code: 'blurry', severity: 'warn', message: 'This photo looks blurry. Hold still and wipe the lens, then retake.' })
  }

  const blocked = issues.some((i) => i.severity === 'block' || i.severity === 'nofaces')
  return { checked: true, faces: faces.length, issues, blocked, yaw, stats, box, overridable: blocked && issues.every((i) => i.severity !== 'block') }
}

/** Pose rules. `turn` = how far the nose is from center (0 = straight on). Thresholds are deliberately
 *  forgiving: we want "clearly turned" for side photos, not an exact angle. */
export const TURN_MIN = 0.1    // side photos need at least this much turn (roughly 20 degrees)
export const TURN_MAX = 0.2    // beyond ~35 degrees the skin-analysis engine usually rejects the photo
export const STRAIGHT_MAX = 0.1

function addPoseIssues(issues: PhotoIssue[], view: View, yaw: number, mirrored?: boolean) {
  const turn = yaw - 0.5
  if (view === 'front') {
    if (Math.abs(turn) > STRAIGHT_MAX) issues.push({ code: 'not-straight', severity: 'warn', message: 'Look straight at the camera, with your nose in the middle of your face.' })
    return
  }
  const t = Math.abs(turn)
  if (t < TURN_MIN) { issues.push({ code: 'turn-more', severity: 'warn', message: `Turn your head a little more to your ${view} — just a quarter turn, about 20°.` }); return }
  if (t > TURN_MAX) { issues.push({ code: 'turn-less', severity: 'warn', message: 'That is too far round. Turn back a little — the analysis needs most of your face to stay visible.' }); return }
  // Which way the head turned is deliberately not enforced: mirrored previews make left/right easy to mix up,
  // and the analysis only needs a slight turn to either side.
}

/** Loads a data-URL/blob photo into an <img> so it can be checked. */
export function imageFromSrc(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/** YouCam needs the face to fill most of the photo width (over 60%), but a selfie taken at arm's length has the
 *  face at 35-50%. Crop to the face with a little margin (3:4 portrait) so the engine gets what it needs.
 *  Returns the original photo if there is nothing useful to crop or the browser can't decode it. */
export async function cropToFace(src: string, box: NonNullable<PhotoCheck['box']>, faceShare = 0.72): Promise<string> {
  try {
    const img = await imageFromSrc(src)
    const W = img.naturalWidth, H = img.naturalHeight
    const cx = (box.x + box.w / 2) * W, cy = (box.y + box.h / 2) * H
    const cropW = Math.min((box.w * W) / faceShare, W, (H * 3) / 4)
    if (cropW >= W * 0.93) return src            // already tight enough
    const cropH = (cropW * 4) / 3
    const x0 = Math.max(0, Math.min(W - cropW, cx - cropW / 2))
    const y0 = Math.max(0, Math.min(H - cropH, cy - cropH / 2))
    const outW = Math.round(Math.min(1280, Math.max(560, cropW)))   // YouCam needs >= 480px on the short side
    const c = document.createElement('canvas')
    c.width = outW; c.height = Math.round((outW * 4) / 3)
    c.getContext('2d')!.drawImage(img, x0, y0, cropW, cropH, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', 0.88)
  } catch {
    return src
  }
}
