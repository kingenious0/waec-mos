import { hashSync, verifySync } from '@node-rs/argon2'

/**
 * Field-officer PINs — argon2id with the server pepper.
 * Legacy scrypt PIN hashes were invalidated in the Phase 1 migration;
 * verifiers reject anything that isn't argon2id.
 */
const PEPPER = (process.env.AUTH_PEPPER || '').trim()
const ARGON_OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1 }
const DUMMY_INPUT = 'mos-timing-sentinel'

const pepper = (input: string) => (PEPPER ? `${PEPPER}${input}` : input)

export function hashPin(pin: string): string {
  return hashSync(pepper(pin.trim()), ARGON_OPTS)
}

export function verifyPin(input: string, storedHash: string | null | undefined): boolean {
  if (!input || !storedHash) {
    // Keep timing similar to avoid leaking whether the officer exists.
    try {
      verifySync(hashSync(pepper(DUMMY_INPUT), ARGON_OPTS), pepper(input || DUMMY_INPUT))
    } catch {
      // ignore
    }
    return false
  }
  if (!storedHash.startsWith('$argon2id')) return false
  try {
    return verifySync(storedHash, pepper(input.trim()))
  } catch {
    return false
  }
}
