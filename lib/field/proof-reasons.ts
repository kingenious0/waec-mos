/**
 * Why HQ or a group leader would ask for the rare exception photo.
 *
 * Routine attendance is GPS-based, so the reason list stays short and plain:
 * a controller should be able to send one request in two taps, and an officer
 * should immediately understand what is being asked of them.
 */

export const PROOF_REQUEST_REASONS = [
  'Please confirm you are at the centre',
  'We need a photo of the exam room',
  'Your arrival time needs checking',
] as const

export type ProofRequestReason = (typeof PROOF_REQUEST_REASONS)[number]

export function isProofRequestReason(value: unknown): value is ProofRequestReason {
  return typeof value === 'string' && (PROOF_REQUEST_REASONS as readonly string[]).includes(value)
}
