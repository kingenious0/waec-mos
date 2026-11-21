/**
 * Shared geo maths for the field workflow.
 *
 * One haversine implementation, used by the check-in geofence, the arrival
 * engine's distance checks and the telemetry "impossible movement" screen —
 * so a distance means the same thing everywhere.
 */

const EARTH_RADIUS_M = 6371000

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/** Great-circle distance between two WGS84 points, in meters. */
export function haversineMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  const dLat = toRadians(bLat - aLat)
  const dLng = toRadians(bLng - aLng)
  const lat1 = toRadians(aLat)
  const lat2 = toRadians(bLat)

  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const a = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)))
}

/**
 * Ground speed implied by two fixes, in km/h.
 * Returns null when either fix or the time gap is unusable.
 */
export function impliedSpeedKmh(
  a: { lat: number; lng: number; atMs: number },
  b: { lat: number; lng: number; atMs: number }
): number | null {
  const dtSeconds = (b.atMs - a.atMs) / 1000
  if (!Number.isFinite(dtSeconds) || dtSeconds <= 0) return null
  // Under 15 seconds the jump is GPS noise, not travel — don't judge it.
  if (dtSeconds < 15) return null

  const meters = haversineMeters(a.lat, a.lng, b.lat, b.lng)
  if (!Number.isFinite(meters)) return null
  return (meters / dtSeconds) * 3.6
}

/**
 * Faster than any vehicle realistically moves on Ghanaian roads
 * (highway traffic runs ~80–110 km/h). Above this the phone "teleported",
 * which means a spoofed location or a broken GPS fix — never a real drive.
 */
export const IMPOSSIBLE_SPEED_KMH = 150

export function isImpossibleMovement(
  a: { lat: number; lng: number; atMs: number },
  b: { lat: number; lng: number; atMs: number }
): { speedKmh: number } | null {
  const speedKmh = impliedSpeedKmh(a, b)
  if (speedKmh === null || speedKmh < IMPOSSIBLE_SPEED_KMH) return null
  return { speedKmh: Math.round(speedKmh) }
}
