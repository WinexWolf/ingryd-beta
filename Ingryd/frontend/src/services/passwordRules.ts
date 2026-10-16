export interface PasswordRule {
  id: string
  label: string
  test: (pw: string) => boolean
}

export const PASSWORD_RULES: PasswordRule[] = [
  { id: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { id: 'lower', label: 'One lowercase letter (a–z)', test: (p) => /[a-z]/.test(p) },
  { id: 'upper', label: 'One uppercase letter (A–Z)', test: (p) => /[A-Z]/.test(p) },
  { id: 'number', label: 'One number (0–9)', test: (p) => /\d/.test(p) },
  { id: 'symbol', label: 'One symbol, like ! @ # $ %', test: (p) => /[^A-Za-z0-9\s]/.test(p) },
  { id: 'space', label: 'No spaces', test: (p) => !/\s/.test(p) },
]

export function checkPassword(pw: string) {
  const results = PASSWORD_RULES.map((r) => ({ ...r, ok: r.test(pw) }))
  return { results, valid: results.every((r) => r.ok), passed: results.filter((r) => r.ok).length }
}
