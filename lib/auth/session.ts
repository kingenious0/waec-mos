import { store, UserAccount } from '@/lib/db'

export const AUTH_STORAGE_KEY = 'waec_mos_session'

export interface SessionData {
  userId: string
  staffId: string
  email: string
  name: string
  phone?: string
  pin?: string
  role: 'ADMIN' | 'FIELD_OFFICER'
  status: 'ACTIVE' | 'REVOKED'
  region?: string
  group?: string
  isGroupLeader?: boolean
  assignedCenter: string
  assignedCenterCode: string
  photo?: string
  mustChangePassword: boolean
}

export function getCurrentClientSession(): SessionData | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as SessionData
  } catch {
    return null
  }
}

export function setClientSession(user: UserAccount) {
  if (typeof window === 'undefined') return
  const data: SessionData = {
    userId: user.id,
    staffId: user.staffId,
    email: user.email,
    name: user.name,
    phone: user.phone,
    pin: user.pin,
    role: user.role,
    status: user.status,
    region: user.region || 'Ashanti Region',
    group: user.group || 'Group 1',
    isGroupLeader: user.isGroupLeader || false,
    assignedCenter: user.assignedCenter,
    assignedCenterCode: user.assignedCenterCode,
    photo: user.photo || '',
    mustChangePassword: user.mustChangePassword,
  }
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data))
  // Also set cookie for middleware compatibility
  document.cookie = `waec_role=${user.role}; path=/; max-age=86400; SameSite=Lax`
  document.cookie = `waec_user=${user.id}; path=/; max-age=86400; SameSite=Lax`
}

export function clearClientSession() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(AUTH_STORAGE_KEY)
  document.cookie = 'waec_role=; path=/; max-age=0'
  document.cookie = 'waec_user=; path=/; max-age=0'
}
