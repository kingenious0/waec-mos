import crypto from 'crypto'
import { hashSync, verifySync } from '@node-rs/argon2'

/**
 * Password hashing — argon2id with a server-side pepper from env.
 * Existing scrypt hashes ("salt:hex") still verify so nobody is locked out
 * before their next change; new hashes are argon2id.
 *
 * AUTH_PEPPER must be set to a long random value in production. When it is
 * missing we loudly warn and run pepperless so local dev keeps working.
 */
const PEPPER = (process.env.AUTH_PEPPER || '').trim()
if (!PEPPER && process.env.NODE_ENV === 'production') {
  console.warn(
    '[security] AUTH_PEPPER is not set — passwords are being hashed WITHOUT the server pepper. Set AUTH_PEPPER in the environment.'
  )
}

const ARGON_OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1 }
const DUMMY_INPUT = 'mos-timing-sentinel'

const pepper = (input: string) => (PEPPER ? `${PEPPER}${input}` : input)

export function hashPassword(password: string): string {
  return hashSync(pepper(password), ARGON_OPTS)
}

export function verifyPassword(password: string, storedHash: string | null | undefined): boolean {
  if (!storedHash || !password) {
    // Keep timing similar to a real verify so we don't leak user existence.
    verifySync(hashSync(pepper(DUMMY_INPUT), ARGON_OPTS), pepper(password))
    return false
  }

  if (storedHash.startsWith('$argon2id')) {
    try {
      return verifySync(storedHash, pepper(password))
    } catch {
      return false
    }
  }

  // Legacy scrypt hashes — still accepted so existing accounts keep working.
  return scryptVerify(password, storedHash)
}

let cachedDummy: string | null = null
/** Constant-ish timing for "user not found" — run the same argon2 verify. */
export function dummyVerify(password: string): void {
  try {
    if (!cachedDummy) cachedDummy = hashSync(pepper(DUMMY_INPUT), ARGON_OPTS)
    verifySync(cachedDummy, pepper(password))
  } catch {
    // intentionally ignored
  }
}

function scryptVerify(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':')
  if (parts.length !== 2) return false
  const [salt, keyHex] = parts
  const keyBuffer = Buffer.from(keyHex, 'hex')

  try {
    const derived = crypto.scryptSync(password, salt, 64)
    if (derived.length === keyBuffer.length && crypto.timingSafeEqual(derived, keyBuffer)) {
      return true
    }
  } catch {
    // fall through to Better Auth params
  }

  try {
    const derivedBa = crypto.scryptSync(password, salt, 64, {
      N: 16384,
      r: 16,
      p: 1,
      maxmem: 64 * 1024 * 1024,
    })
    if (derivedBa.length === keyBuffer.length && crypto.timingSafeEqual(derivedBa, keyBuffer)) {
      return true
    }
  } catch {
    // not verifiable
  }
  return false
}
