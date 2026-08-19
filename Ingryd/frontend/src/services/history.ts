import type { ProductResult, SkinProfile, RoutineProductInput } from '../types'

const SCAN_KEY = 'ingryd_scan_history'
const SKIN_KEY = 'ingryd_skin_history'
const ROUTINE_KEY = 'ingryd_routine'

export interface ScanHistoryEntry {
  id: string
  timestamp: number
  product: ProductResult
}

export interface SkinHistoryEntry {
  id: string
  timestamp: number
  profile: SkinProfile
}

function readList<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T[]) : []
  } catch {
    return []
  }
}

function writeList<T>(key: string, items: T[]) {
  try {
    localStorage.setItem(key, JSON.stringify(items))
  } catch {
    // storage unavailable — fail silently, beta feature is non-critical
  }
}

// ── Scan history ────────────────────────────────────────────
export function getScanHistory(): ScanHistoryEntry[] {
  return readList<ScanHistoryEntry>(SCAN_KEY).sort((a, b) => b.timestamp - a.timestamp)
}

export function addScanToHistory(product: ProductResult) {
  if (!product.found) return
  const entries = readList<ScanHistoryEntry>(SCAN_KEY)
  entries.push({ id: crypto.randomUUID(), timestamp: Date.now(), product })
  writeList(SCAN_KEY, entries.slice(-100))
}

// ── Skin analysis history ───────────────────────────────────
export function getSkinHistory(): SkinHistoryEntry[] {
  return readList<SkinHistoryEntry>(SKIN_KEY).sort((a, b) => b.timestamp - a.timestamp)
}

export function addSkinAnalysisToHistory(profile: SkinProfile) {
  const entries = readList<SkinHistoryEntry>(SKIN_KEY)
  entries.push({ id: crypto.randomUUID(), timestamp: Date.now(), profile })
  writeList(SKIN_KEY, entries.slice(-50))
}

// ── Routine (current AM/PM product list) ────────────────────
export function getRoutine(): RoutineProductInput[] {
  return readList<RoutineProductInput>(ROUTINE_KEY)
}

export function saveRoutine(products: RoutineProductInput[]) {
  writeList(ROUTINE_KEY, products)
}
