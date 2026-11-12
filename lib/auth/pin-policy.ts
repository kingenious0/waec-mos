/**
 * Trivial-PIN policy shared by every place a PIN is set:
 * blocks 4-digit patterns that are trivially guessable.
 *   - identical digits (0000, 1111, …)
 *   - ascending / descending runs (0123…7890 / 9876…3210 / 0987)
 *   - the last 4 digits of the officer's own phone number
 */
const BANNED = new Set([
  '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999',
  '0123', '1234', '2345', '3456', '4567', '5678', '6789', '7890',
  '0987', '9876', '8765', '7654', '6543', '5432', '4321', '3210',
])

export interface PinCheckResult {
  ok: boolean
  reason?: string
}

export function validatePin(pin: string, phone?: string): PinCheckResult {
  const p = String(pin || '').trim()
  if (!/^\d{4}$/.test(p)) {
    return { ok: false, reason: 'PIN must be exactly 4 digits.' }
  }
  if (BANNED.has(p)) {
    return { ok: false, reason: 'That PIN is too easy to guess.' }
  }
  const last4 = (phone || '').replace(/\D/g, '').slice(-4)
  if (last4 && p === last4) {
    return { ok: false, reason: 'PIN can’t be the last 4 digits of the phone number.' }
  }
  return { ok: true }
}
