/**
 * Day-aware time formatting for the incidents page and activity history.
 * Ghana keeps GMT year-round, so all rendering pins to Africa/Accra (GMT).
 */

const TZ = 'Africa/Accra'

function parse(iso?: string | null): Date | null {
  if (!iso) return null
  const ts = Date.parse(iso)
  return Number.isNaN(ts) ? null : new Date(ts)
}

function timeOf(d: Date): string {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
}

function dayDiff(d: Date): number {
  const startOf = (x: Date) => {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(x)
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
    return Date.UTC(get('year'), get('month') - 1, get('day'))
  }
  return Math.round((startOf(new Date()) - startOf(d)) / 86_400_000)
}

/** "Today 04:53" / "Yesterday 04:53" / "12 Nov 04:53" */
export function formatDayTime(iso?: string | null): string {
  const d = parse(iso)
  if (!d) return ''
  const diff = dayDiff(d)
  const time = timeOf(d)
  if (diff === 0) return `Today ${time}`
  if (diff === 1) return `Yesterday ${time}`
  return `${d.toLocaleDateString('en-GB', { timeZone: TZ, day: 'numeric', month: 'short' })} ${time}`
}

/** "04:53" — for use inside a day-grouped list (the group header carries the date). */
export function formatTimeOnly(iso?: string | null): string {
  const d = parse(iso)
  return d ? timeOf(d) : '--:--'
}

/** Group header: "Today" / "Yesterday" / "12 Nov" */
export function dayGroupLabel(iso?: string | null): string {
  const d = parse(iso)
  if (!d) return 'Earlier'
  const diff = dayDiff(d)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { timeZone: TZ, day: 'numeric', month: 'short' })
}

/** "4 min" / "2 h 10 min" / "3 days" between two ISO stamps. */
export function formatDurationBetween(startIso?: string | null, endIso?: string | null): string {
  const a = parse(startIso)
  const b = parse(endIso)
  if (!a || !b) return ''
  const ms = Math.max(0, b.getTime() - a.getTime())
  const minutes = Math.round(ms / 60_000)
  if (minutes < 1) return 'under a minute'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) {
    const rem = minutes % 60
    return rem > 0 ? `${hours} h ${rem} min` : `${hours} h`
  }
  const days = Math.floor(hours / 24)
  return days === 1 ? '1 day' : `${days} days`
}

/** How long an open incident has been waiting: "12 min" / "3 h 20 min". */
export function formatWaitingSince(iso?: string | null): string {
  const d = parse(iso)
  if (!d) return 'a while'
  return formatDurationBetween(iso, new Date().toISOString())
}
