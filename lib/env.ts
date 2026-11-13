import { z } from 'zod'

/**
 * Validate required server-side environment variables at boot.
 * Missing/invalid values throw a descriptive error immediately —
 * better to fail loudly at deploy time than silently at run time.
 * In tests, a placeholder DATABASE_URL is tolerated (routes run against
 * the in-memory store fallback).
 */
const isTest = process.env.NODE_ENV === 'test'

const schema = z.object({
  DATABASE_URL: z.string().url().startsWith('postgresql://'),
  BETTER_AUTH_SECRET: z.string().min(16).optional(),
  AUTH_PEPPER: z.string().min(16).optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
})

const envInput = { ...process.env }
if (isTest && !envInput.DATABASE_URL) {
  envInput.DATABASE_URL = 'postgresql://placeholder:placeholder@localhost:5432/test'
}

const parsed = schema.safeParse(envInput)

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
  throw new Error(`Invalid environment: ${issues}`)
}

export const env = parsed.data
