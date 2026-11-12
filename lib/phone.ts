/**
 * Format a Ghanaian phone number as "+233 XX XXX XXXX", e.g. "+233 24 411 0001".
 * Accepts "0506746307", "233506746307", "+233 50 674 6307", etc.
 * Returns the trimmed input unchanged when it can't be normalized.
 */
export function formatGhanaPhone(raw?: string | null): string {
  if (!raw) return '—'
  const digits = String(raw).replace(/\D/g, '')
  let core = digits
  if (core.startsWith('233')) core = core.slice(3)
  else if (core.startsWith('0')) core = core.slice(1)

  if (core.length === 9) {
    return `+233 ${core.slice(0, 2)} ${core.slice(2, 5)} ${core.slice(5)}`
  }
  return String(raw).trim()
}
