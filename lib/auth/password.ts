import crypto from 'crypto'

/**
 * Generates a salted scrypt password hash formatted as "salt:hexKey".
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${derivedKey}`
}

/**
 * Verifies a plaintext password against a stored "salt:hexKey" scrypt hash.
 * Supports both Node default scrypt parameters and Better Auth (N=16384, r=16, p=1) hashes.
 */
export function verifyPassword(password: string, storedHash: string | null | undefined): boolean {
  if (!storedHash || !password) return false
  const parts = storedHash.split(':')
  if (parts.length !== 2) {
    return password === storedHash
  }

  const [salt, keyHex] = parts
  const keyBuffer = Buffer.from(keyHex, 'hex')

  try {
    const derived = crypto.scryptSync(password, salt, 64)
    if (derived.length === keyBuffer.length && crypto.timingSafeEqual(derived, keyBuffer)) {
      return true
    }
  } catch {
    // Fall through to alternative cost parameters
  }

  try {
    // Better Auth uses N=16384, r=16, p=1
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
    return false
  }

  return false
}

