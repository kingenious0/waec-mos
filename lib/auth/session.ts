/**
 * Client-side view of the signed-in user. The browser never holds session
 * state — it only holds the httpOnly `mos_session` cookie, which is set and
 * cleared by the server. `getClientSession` fetches /api/auth/me and returns
 * null when there is no valid server session.
 */
export interface SessionData {
  userId: string
  staffId: string
  email: string
  name: string
  phone?: string                    // never populated server-side
  pin?: string                      // write-path only (admin reset/pre-provision). Server never sends it.
  role: 'ADMIN' | 'FIELD_OFFICER'
  status: 'ACTIVE' | 'REVOKED'
  region?: string
  group?: string
  isGroupLeader?: boolean
  assignedCenter: string
  assignedCenterCode: string
  photo?: string
  bio?: string
  mustChangePassword: boolean
  paperName?: string
  startTime?: string
  endTime?: string
}

const LEGACY_KEY = 'waec_mos_session'
const LEGACY_ROLE_COOKIE = 'waec_role'
const LEGACY_USER_COOKIE = 'waec_user'

export async function getClientSession(): Promise<SessionData | null> {
  try {
    const res = await fetch('/api/auth/me', { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    return (data.user as SessionData) || null
  } catch {
    return null
  }
}

/** Wipe every trace of legacy client-auth state (used on sign-out paths). */
export function clearLegacyClientState() {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(LEGACY_KEY)
  } catch {
    // storage may be unavailable (private mode) — ignore
  }
  document.cookie = `${LEGACY_ROLE_COOKIE}=; path=/; max-age=0`
  document.cookie = `${LEGACY_USER_COOKIE}=; path=/; max-age=0`
}

/** Sign out everywhere client-side knows about. Server clears the cookie. */
export async function signOutEverywhere(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST' })
  } catch {
    // network failure is fine — cookie will also expire
  }
  clearLegacyClientState()
}
