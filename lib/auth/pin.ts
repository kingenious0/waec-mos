import { hashPassword, verifyPassword } from './password'

/**
 * Field-officer PINs are stored ONLY as scrypt hashes — never in plain text.
 * `verifyPin` transparently accepts legacy plaintext values so existing rows
 * keep working until they're re-hashed (scripts/hash_officer_pins.js upgrades
 * them in place).
 */
export function hashPin(pin: string): string {
  return hashPassword(pin.trim())
}

export function verifyPin(input: string, storedHash: string | null | undefined): boolean {
  if (!input) return false
  return verifyPassword(input.trim(), storedHash)
}
