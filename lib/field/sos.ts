/**
 * Emergency SOS interaction rules.
 *
 * These constants are shared by the officer trigger and its tests so the
 * emergency gesture stays fast, predictable and consistent across web and APK.
 */

/** One second is long enough to prevent a pocket dial, short enough under stress. */
export const SOS_HOLD_MS = 1000

/** How long the "help sent" confirmation stays visible before the button resets. */
export const SOS_RESET_MS = 3200

/** Clamped 0..1 progress for the hold ring. */
export function sosHoldProgress(elapsedMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0
  return Math.min(1, elapsedMs / SOS_HOLD_MS)
}

/** Plain-language countdown shown while the officer is holding. */
export function sosCountdownLabel(progress: number): string {
  const clamped = Math.min(1, Math.max(0, progress))
  if (clamped >= 1) return 'Sending now'
  const remaining = Math.ceil((1 - clamped) * (SOS_HOLD_MS / 1000) * 10) / 10
  return `Keep holding… ${remaining.toFixed(1)}s`
}

/** Result line after a completed hold. */
export function sosResultLabel(isOffline: boolean): string {
  return isOffline
    ? 'SOS saved — it will send when you are back online'
    : 'Help sent — Regional Command has your location'
}
