/** Barcode helpers shared by the camera scanner and manual entry. */

export const digitsOnly = (s: string) => s.replace(/\D/g, '')

const LENGTHS = [8, 12, 13, 14]

/** Standard GTIN mod-10 check digit (EAN-8, UPC-A, EAN-13, GTIN-14). */
export function gtinCheckOk(code: string): boolean {
  if (!/^\d+$/.test(code) || !LENGTHS.includes(code.length)) return false
  const body = code.slice(0, -1).split('').reverse()
  const total = body.reduce((sum, d, i) => sum + Number(d) * (i % 2 === 0 ? 3 : 1), 0)
  return (10 - (total % 10)) % 10 === Number(code[code.length - 1])
}

/** UPC-E (8 digits, number system 0/1) -> UPC-A (12 digits). */
export function expandUpcE(code: string): string | null {
  if (!/^[01]\d{7}$/.test(code)) return null
  const [ns, a, b, c, d, e, f, check] = code.split('')
  let body: string
  if ('012'.includes(f)) body = `${ns}${a}${b}${f}0000${c}${d}${e}`
  else if (f === '3') body = `${ns}${a}${b}${c}00000${d}${e}`
  else if (f === '4') body = `${ns}${a}${b}${c}${d}00000${e}`
  else body = `${ns}${a}${b}${c}${d}${e}0000${f}`
  return body + check
}

/** A scanned/typed code is plausible if its check digit works as written, or as UPC-E. */
export function looksLikeRealBarcode(code: string): boolean {
  if (gtinCheckOk(code)) return true
  const upca = expandUpcE(code)
  return !!upca && gtinCheckOk(upca)
}
