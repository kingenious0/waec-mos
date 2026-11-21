/**
 * Arrival and departure events carry two clocks.
 *
 * phoneTime is when the officer's device saw the event (important when the
 * phone was offline); serverTime is when Regional Command received it. The
 * server time is official, but a lost connection must not erase what happened
 * on the ground — so the device time is the honest fallback.
 */

type TimeValue = string | Date | null | undefined

function toMs(value: TimeValue): number | null {
  if (!value) return null
  const ms = value instanceof Date ? value.getTime() : Date.parse(value)
  return Number.isFinite(ms) ? ms : null
}

/** Server time wins; device time is used only when the server time is missing. */
export function resolveEventMs(serverTime: TimeValue, phoneTime?: TimeValue): number | null {
  return toMs(serverTime) ?? toMs(phoneTime)
}

/** Should an offline arrival payload stay queued for the next reconnect? */
export function shouldRetryArrivalDelivery(status: number): boolean {
  return status === 401 || status === 408 || status === 429 || status >= 500
}
