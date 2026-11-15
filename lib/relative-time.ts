/** One shared relative-time vocabulary for the whole console. */

const MINUTE = 60_000
const HOUR = 3_600_000
const DAY = 86_400_000

/** True when telemetry is older than `maxMinutes` (default 5). */
export function isStaleTelemetry(iso?: string | null, maxMinutes = 5): boolean {
  if (!iso) return true
  const ts = Date.parse(iso)
  if (Number.isNaN(ts)) return true
  return Date.now() - ts > maxMinutes * MINUTE
}

/**
 * "Just now" | "12 min ago" | "1 hour ago" | "3 hours ago" | "Yesterday, 18:30" | "12 Feb 2026"
 */
export function formatRelativeTime(iso?: string | null): string {
  if (!iso) return 'Never'
  const ts = Date.parse(iso)
  if (Number.isNaN(ts)) return 'Never'
  const diff = Date.now() - ts

  if (diff < MINUTE) return 'Just now'
  if (diff < HOUR) {
    const mins = Math.max(1, Math.floor(diff / MINUTE))
    return `${mins} min ago`
  }
  if (diff < DAY) {
    const hours = Math.floor(diff / HOUR)
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`
  }
  const days = Math.floor(diff / DAY)
  if (days === 1) {
    const time = new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    return `Yesterday, ${time}`
  }
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** "No update for 12 min ago" style phrases — the stale-marker counterpart. */
export function formatNoUpdate(iso?: string | null): string {
  if (!iso) return 'No update yet'
  const ts = Date.parse(iso)
  if (Number.isNaN(ts)) return 'No update yet'
  const diff = Date.now() - ts
  if (diff < MINUTE) return 'No update just now'
  if (diff < HOUR) {
    const mins = Math.max(1, Math.floor(diff / MINUTE))
    return `No update for ${mins} min`
  }
  if (diff < DAY) {
    const hours = Math.floor(diff / HOUR)
    return hours === 1 ? 'No update for 1 hour' : `No update for ${hours} hours`
  }
  const days = Math.floor(diff / DAY)
  return days === 1 ? 'No update for 1 day' : `No update for ${days} days`
}

/** Exact absolute time for tooltips, e.g. "05:10 GMT". */
export function formatTooltipTime(iso?: string | null): string {
  if (!iso) return 'No update yet'
  const ts = Date.parse(iso)
  if (Number.isNaN(ts)) return 'No update yet'
  return (
    new Date(ts).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    }) || ''
  )
}
