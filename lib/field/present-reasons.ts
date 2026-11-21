/**
 * Fixed reasons a group leader can record instead of GPS proof.
 *
 * Shared by the arrival API (validation) and the field app (the picker), so
 * the two lists can never drift apart.
 */
export const PRESENT_REASONS = [
  'Phone battery dead',
  'No network signal',
  'App crashed',
  'Wrong centre — moved',
] as const

export type PresentReason = (typeof PRESENT_REASONS)[number]

export function isPresentReason(value: string): value is PresentReason {
  return (PRESENT_REASONS as readonly string[]).includes(value)
}
