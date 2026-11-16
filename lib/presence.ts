/**
 * Shared "is this officer at the centre right now?" rule.
 *
 * One function, used by the live map, the Officers page summary and the
 * Exam centres page, so the same officer can never be counted as "at the
 * centre" in one place and "nowhere" in another.
 *
 * Rule: the officer must have a FRESH update (under 5 minutes old) AND
 * their last known distance must be inside the centre's check-in area
 * radius. A stale position — however close it was when recorded — does
 * not count.
 */

import { isStaleTelemetry } from './relative-time'

export interface PresenceLike {
  lastPingAt?: string | null
  /** Meters from the assigned centre at the last update. */
  distanceFromDatum?: number | null
  /** Effective check-in area radius for the assigned centre, in meters. */
  centerRadius?: number | null
}

export const DEFAULT_CHECK_IN_RADIUS_M = 150
export const FRESH_UPDATE_MINUTES = 5

export function isFreshUpdate(lastPingAt?: string | null, maxMinutes = FRESH_UPDATE_MINUTES): boolean {
  return !isStaleTelemetry(lastPingAt, maxMinutes)
}

export function effectiveRadius(centerRadius?: number | null): number {
  return typeof centerRadius === 'number' && Number.isFinite(centerRadius) && centerRadius > 0
    ? centerRadius
    : DEFAULT_CHECK_IN_RADIUS_M
}

/** True only when we have a fresh update AND it was inside the check-in area. */
export function isOfficerAtCentre(officer: PresenceLike): boolean {
  if (!isFreshUpdate(officer.lastPingAt)) return false
  const d = officer.distanceFromDatum
  if (typeof d !== 'number' || !Number.isFinite(d)) return false
  return d <= effectiveRadius(officer.centerRadius)
}
