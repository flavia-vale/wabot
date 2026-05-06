export function normalizeEmail(rawEmail) {
  if (typeof rawEmail !== 'string') return ''
  return rawEmail.trim().toLowerCase()
}
