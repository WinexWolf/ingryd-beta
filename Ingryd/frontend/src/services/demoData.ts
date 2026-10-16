import { supabase } from './supabaseClient'
import type { SkinProfile } from '../types'

/** Example data so the app can be explored (or judged) without weeks of real scans.
 *  Everything it creates is labelled: scans carry `demo: true`, routine products start
 *  with "(Demo)". "Remove demo data" deletes exactly those rows and nothing else. */

const OLDER: SkinProfile = {"hydration": {"score": 74, "label": "Well hydrated"}, "oiliness": {"score": 30, "label": "Well balanced"}, "redness": {"score": 20, "label": "Calm"}, "texture": {"score": 36, "label": "Some texture"}, "overall_score": 72, "recommended_ingredients": ["Caffeine", "Vitamin C", "Niacinamide", "Salicylic acid", "Azelaic acid", "Zinc oxide", "Lactic acid", "Retinol (start low, PM only)"], "notes": ["Under-eye darkness detected \u2014 caffeine or vitamin C eye products plus sleep and SPF.", "Breakout signal detected \u2014 introduce exfoliating acids slowly, 2-3x/week.", "Pores are more visible \u2014 niacinamide and a gentle BHA can help refine them.", "Your T-zone reads oily while your cheeks read normal \u2014 treat the zones differently."], "source": "youcam", "skin_type": "Combination", "skin_age": 31, "concerns": {"moisture": 74, "oiliness": 70, "redness": 80, "acne": 62, "pore": 64, "texture": 66, "wrinkle": 86, "age_spot": 80, "dark_circle_v2": 60}, "skin_type_zones": {"t_zone": "Oily", "u_zone": "Normal"}, "suggested_skin_type": "combination", "suggested_concerns": ["acne", "dark circles", "texture", "dryness"], "areas": [{"key": "dark_circle_v2", "label": "Dark circles", "score": 60, "status": "attention", "tip": "Under-eye darkness detected \u2014 caffeine or vitamin C eye products plus sleep and SPF.", "ingredients": ["Caffeine", "Vitamin C", "Niacinamide"]}, {"key": "acne", "label": "Breakouts", "score": 62, "status": "attention", "tip": "Breakout signal detected \u2014 introduce exfoliating acids slowly, 2-3x/week.", "ingredients": ["Salicylic acid", "Niacinamide", "Azelaic acid"]}, {"key": "pore", "label": "Pores", "score": 64, "status": "attention", "tip": "Pores are more visible \u2014 niacinamide and a gentle BHA can help refine them.", "ingredients": ["Salicylic acid", "Niacinamide", "Lactic acid"]}, {"key": "texture", "label": "Texture", "score": 66, "status": "attention", "tip": "Uneven texture detected \u2014 gentle chemical exfoliation helps smooth it over time.", "ingredients": ["Lactic acid", "Azelaic acid", "Salicylic acid"]}, {"key": "oiliness", "label": "Oil balance", "score": 70, "status": "attention", "tip": "Oil balance needs attention \u2014 a lightweight niacinamide serum can help.", "ingredients": ["Niacinamide", "Salicylic acid", "Zinc oxide"]}, {"key": "moisture", "label": "Hydration", "score": 74, "status": "attention", "tip": "Skin is reading dehydrated \u2014 layer a humectant under a moisturizer.", "ingredients": ["Hyaluronic acid", "Glycerin", "Ceramides"]}, {"key": "redness", "label": "Redness", "score": 80, "status": "watch", "tip": "Your redness score is okay but not your strongest \u2014 Centella asiatica helps keep it from slipping.", "ingredients": ["Centella asiatica", "Panthenol", "Bisabolol"]}, {"key": "age_spot", "label": "Dark spots", "score": 80, "status": "watch", "tip": "Your dark spots score is okay but not your strongest \u2014 Vitamin C helps keep it from slipping.", "ingredients": ["Vitamin C", "Niacinamide", "Azelaic acid"]}, {"key": "wrinkle", "label": "Fine lines", "score": 86, "status": "good", "tip": "Fine lines looks healthy \u2014 nothing to change here.", "ingredients": ["Retinol (start low, PM only)", "Peptides", "Vitamin C"]}], "is_sample": false} as SkinProfile
const NEWER: SkinProfile = {"hydration": {"score": 80, "label": "Well hydrated"}, "oiliness": {"score": 24, "label": "Well balanced"}, "redness": {"score": 15, "label": "Calm"}, "texture": {"score": 28, "label": "Smooth"}, "overall_score": 78, "recommended_ingredients": ["Caffeine", "Vitamin C", "Niacinamide", "Salicylic acid", "Lactic acid", "Azelaic acid", "Zinc oxide", "Retinol (start low, PM only)"], "notes": ["Under-eye darkness detected \u2014 caffeine or vitamin C eye products plus sleep and SPF.", "Pores are more visible \u2014 niacinamide and a gentle BHA can help refine them.", "Breakout signal detected \u2014 introduce exfoliating acids slowly, 2-3x/week.", "Your T-zone reads oily while your cheeks read normal \u2014 treat the zones differently."], "source": "youcam", "skin_type": "Combination", "skin_age": 29, "concerns": {"moisture": 80, "oiliness": 76, "redness": 85, "acne": 72, "pore": 70, "texture": 74, "wrinkle": 88, "age_spot": 82, "dark_circle_v2": 66}, "skin_type_zones": {"t_zone": "Oily", "u_zone": "Normal"}, "suggested_skin_type": "combination", "suggested_concerns": ["acne", "dark circles", "texture"], "areas": [{"key": "dark_circle_v2", "label": "Dark circles", "score": 66, "status": "attention", "tip": "Under-eye darkness detected \u2014 caffeine or vitamin C eye products plus sleep and SPF.", "ingredients": ["Caffeine", "Vitamin C", "Niacinamide"]}, {"key": "pore", "label": "Pores", "score": 70, "status": "attention", "tip": "Pores are more visible \u2014 niacinamide and a gentle BHA can help refine them.", "ingredients": ["Salicylic acid", "Niacinamide", "Lactic acid"]}, {"key": "acne", "label": "Breakouts", "score": 72, "status": "attention", "tip": "Breakout signal detected \u2014 introduce exfoliating acids slowly, 2-3x/week.", "ingredients": ["Salicylic acid", "Niacinamide", "Azelaic acid"]}, {"key": "texture", "label": "Texture", "score": 74, "status": "attention", "tip": "Uneven texture detected \u2014 gentle chemical exfoliation helps smooth it over time.", "ingredients": ["Lactic acid", "Azelaic acid", "Salicylic acid"]}, {"key": "oiliness", "label": "Oil balance", "score": 76, "status": "watch", "tip": "Your oil balance score is okay but not your strongest \u2014 Niacinamide helps keep it from slipping.", "ingredients": ["Niacinamide", "Salicylic acid", "Zinc oxide"]}, {"key": "moisture", "label": "Hydration", "score": 80, "status": "watch", "tip": "Your hydration score is okay but not your strongest \u2014 Hyaluronic acid helps keep it from slipping.", "ingredients": ["Hyaluronic acid", "Glycerin", "Ceramides"]}, {"key": "age_spot", "label": "Dark spots", "score": 82, "status": "watch", "tip": "Your dark spots score is okay but not your strongest \u2014 Vitamin C helps keep it from slipping.", "ingredients": ["Vitamin C", "Niacinamide", "Azelaic acid"]}, {"key": "redness", "label": "Redness", "score": 85, "status": "good", "tip": "Redness looks healthy \u2014 nothing to change here.", "ingredients": ["Centella asiatica", "Panthenol", "Bisabolol"]}, {"key": "wrinkle", "label": "Fine lines", "score": 88, "status": "good", "tip": "Fine lines looks healthy \u2014 nothing to change here.", "ingredients": ["Retinol (start low, PM only)", "Peptides", "Vitamin C"]}], "is_sample": false} as SkinProfile

/** Offline copy of the example scan, so "See a sample scan" works even when the server is
 *  asleep, restarting or running an older version. Always labelled as a sample. */
export function sampleFallback(): SkinProfile {
  return { ...NEWER, is_sample: true, demo: false }
}

const CLEANSER = { name: '(Demo) Gentle Foaming Cleanser', slot: 'am' as const,
  ingredients: ['Water', 'Glycerin', 'Cocamidopropyl Betaine', 'Sodium Lauroyl Sarcosinate', 'Panthenol', 'Phenoxyethanol'] }
const CREAM = { name: '(Demo) Rich Night Cream', slot: 'pm' as const,
  ingredients: ['Water', 'Isopropyl Myristate', 'Coconut Oil', 'Glycerin', 'Cetearyl Alcohol', 'Phenoxyethanol'] }
const SERUM = { name: '(Demo) BHA Clarifying Serum', slot: 'pm' as const,
  ingredients: ['Water', 'Salicylic Acid', 'Niacinamide', 'Zinc PCA', 'Glycerin', 'Panthenol', 'Phenoxyethanol'] }

const snap = (items: { name: string; slot: 'am' | 'pm' }[]) => items.map(({ name, slot }) => ({ name, slot }))
const DAY = 86_400_000

async function userId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

export async function clearDemoData(): Promise<void> {
  const uid = await userId()
  if (!uid) return
  await supabase.from('skin_analysis_history').delete().eq('user_id', uid).filter('profile->>demo', 'eq', 'true')
  await supabase.from('routine_items').delete().eq('user_id', uid).like('product_name', '(Demo)%')
}

/** Two earlier scans (28 and 12 days ago, improving) and a three-product routine with an
 *  obvious story: a pore-clogging cream, no eye care, no sunscreen. */
export async function loadDemoData(): Promise<boolean> {
  const uid = await userId()
  if (!uid) return false
  await clearDemoData()
  const now = Date.now()
  const hist = await supabase.from('skin_analysis_history').insert([
    { user_id: uid, created_at: new Date(now - 28 * DAY).toISOString(),
      profile: { ...OLDER, demo: true, routine_snapshot: snap([CLEANSER, CREAM]) } },
    { user_id: uid, created_at: new Date(now - 12 * DAY).toISOString(),
      profile: { ...NEWER, demo: true, routine_snapshot: snap([CLEANSER, CREAM, SERUM]) } },
  ])
  const routine = await supabase.from('routine_items').insert(
    [CLEANSER, CREAM, SERUM].map((p) => ({
      user_id: uid, slot: p.slot, product_name: p.name, brand: null, ingredients_parsed: p.ingredients,
    })),
  )
  return !hist.error && !routine.error
}
