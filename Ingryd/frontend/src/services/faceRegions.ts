/**
 * Face-mesh based skin regions for the side check, using MediaPipe Face Landmarker (Apache-2.0, runs in the browser).
 * It returns a mask of the parts of the face worth analysing (cheeks, forehead, chin, jaw), with the eyes, brows
 * and lips cut out, so the colour analysis is not fooled by them. Loaded lazily, only when someone adds a side photo.
 */
const VERSION = '1.2.2'
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`
// Put face_landmarker.task in frontend/public/models/ to serve it yourself; otherwise Google's copy is used.
const MODEL_LOCAL = `${import.meta.env.BASE_URL}models/face_landmarker.task`
const MODEL_REMOTE = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'

// Landmark index loops of the MediaPipe face mesh.
const OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]
const CUT: number[][] = [
  [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466],   // left eye
  [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246],      // right eye
  [276, 283, 282, 295, 285, 300, 293, 334, 296, 336],                                  // left brow
  [46, 53, 52, 65, 55, 70, 63, 105, 66, 107],                                          // right brow
  [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185], // lips
]

type Landmarker = { detect: (img: HTMLImageElement) => { faceLandmarks: { x: number; y: number }[][] } }
let loading: Promise<Landmarker | null> | null = null

async function exists(url: string): Promise<boolean> {
  try { return (await fetch(url, { method: 'HEAD' })).ok } catch { return false }
}

export function loadLandmarker(): Promise<Landmarker | null> {
  if (!loading) {
    loading = (async () => {
      try {
        const { FilesetResolver, FaceLandmarker } = await import('@mediapipe/tasks-vision')
        const vision = await FilesetResolver.forVisionTasks(WASM_URL)
        const modelAssetPath = (await exists(MODEL_LOCAL)) ? MODEL_LOCAL : MODEL_REMOTE
        return (await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath },
          runningMode: 'IMAGE',
          numFaces: 1,
        })) as unknown as Landmarker
      } catch {
        loading = null        // allow a retry later; the caller falls back to the simpler detector
        return null
      }
    })()
  }
  return loading
}

export type RegionResult =
  | { status: 'ok'; mask: Uint8Array }        // 1 = analyse this pixel (width x height of the analysis image)
  | { status: 'no-face' }
  | { status: 'unavailable' }

/** Mask of analysable skin for an image, at the given analysis size. */
export async function skinRegionMask(img: HTMLImageElement, w: number, h: number): Promise<RegionResult> {
  const lm = await loadLandmarker()
  if (!lm) return { status: 'unavailable' }
  let pts: { x: number; y: number }[] | undefined
  try { pts = lm.detect(img).faceLandmarks[0] } catch { return { status: 'unavailable' } }
  if (!pts || pts.length < 400) return { status: 'no-face' }

  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  const poly = (idx: number[], color: string) => {
    ctx.fillStyle = color
    ctx.beginPath()
    idx.forEach((i, k) => { const x = pts![i].x * w, y = pts![i].y * h; if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y) })
    ctx.closePath(); ctx.fill()
  }
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h)
  poly(OVAL, '#fff')
  for (const loop of CUT) poly(loop, '#000')
  const px = ctx.getImageData(0, 0, w, h).data
  const mask = new Uint8Array(w * h)
  for (let i = 0; i < mask.length; i++) mask[i] = px[i * 4] > 200 ? 1 : 0
  return { status: 'ok', mask }
}
