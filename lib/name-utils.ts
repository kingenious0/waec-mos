const KNOWN_TITLES = ['Dr.', 'Prof.', 'Mr.', 'Mrs.', 'Ms.', 'Eng.']

/**
 * Split a display name into title + first + last.
 * "Dr. James Addo" → { title: 'Dr.', firstName: 'James', lastName: 'Addo' }
 * "Kwame Boateng Senior" → { title: '', firstName: 'Kwame', lastName: 'Boateng Senior' }
 */
export function splitName(full: string): {
  title: string
  firstName: string
  lastName: string
} {
  const parts = (full || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) {
    return { title: '', firstName: '', lastName: '' }
  }

  let title = ''
  const firstToken = parts[0]
  if (KNOWN_TITLES.includes(firstToken)) {
    title = firstToken
    parts.shift()
  }

  if (parts.length === 0) {
    return { title, firstName: '', lastName: '' }
  }
  if (parts.length === 1) {
    return { title, firstName: parts[0], lastName: '' }
  }
  return { title, firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

/** "Kwame" + "Boateng" (+ optional title) → "Kwame Boateng" / "Dr. Kwame Boateng" */
export function joinName(title: string, firstName: string, lastName: string): string {
  return [title, firstName, lastName].map((s) => (s || '').trim()).filter(Boolean).join(' ')
}

/** Human-readable role labels used on the profile screen. */
export function humanizeRole(role?: string): string {
  switch ((role || '').toUpperCase()) {
    case 'SUPER_ADMIN':
      return 'National super admin'
    case 'ADMIN':
      return 'Headquarters admin'
    case 'REGIONAL_COORD':
      return 'Regional coordinator'
    case 'SUPERVISOR':
      return 'Centre supervisor'
    case 'FIELD_OFFICER':
      return 'Field officer'
    default:
      return role || 'Field officer'
  }
}

/** "30 days ago" / "Never changed" from an ISO timestamp. */
export function relativeDays(iso?: string | null): string {
  if (!iso) return 'Never changed'
  const ts = Date.parse(iso)
  if (Number.isNaN(ts)) return 'Never changed'
  const days = Math.floor((Date.now() - ts) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return '1 day ago'
  if (days < 30) return `${days} days ago`
  const months = Math.floor(days / 30)
  return months === 1 ? '1 month ago' : `${months} months ago`
}
