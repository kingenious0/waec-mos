import { drizzle } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'
import * as schema from './schema'
import { hashPin, verifyPin } from '@/lib/auth/pin'

const databaseUrl = process.env.DATABASE_URL

// Check if a real Neon database URL is configured
export const isLiveDatabase = Boolean(
  databaseUrl && 
  !databaseUrl.includes('ep-sample-pooler') && 
  databaseUrl.startsWith('postgresql://')
)

// Drizzle instance when live database is configured
export const db = isLiveDatabase 
  ? drizzle(neon(databaseUrl!), { schema }) 
  : null

// --- Core V1 Types ---

export type UserRole = 'ADMIN' | 'FIELD_OFFICER'
export type AccountStatus = 'ACTIVE' | 'REVOKED'
export type DutyStatus = 'OFF_DUTY' | 'ON_DUTY'

export interface UserAccount {
  id: string
  staffId: string
  email: string
  name: string
  phone: string
  pin: string // 4-digit PIN for Field Officer Auth
  role: UserRole
  status: AccountStatus
  region: string // e.g. Ashanti Region
  group: string // Group 1 to Group 10
  isGroupLeader: boolean
  assignedCenter: string
  assignedCenterCode: string
  dutyStatus: DutyStatus
  mustChangePassword: boolean
  passwordHash: string
  photo?: string
  bio?: string
  lastLoginAt?: string
  checkInTime?: string
  paperName?: string
  startTime?: string
  endTime?: string
}

// --- V1 Data Store with Seed Data ---

class MosV1Store {
  users: UserAccount[] = [
    {
      id: 'usr-admin-1',
      staffId: 'WAEC-HQ-001',
      email: 'admin@waec.org',
      name: 'Dr. James Addo',
      phone: '+233 24 111 2233',
      pin: '0001',
      role: 'ADMIN',
      status: 'ACTIVE',
      region: 'Ashanti Region',
      group: 'HQ Command',
      isGroupLeader: true,
      assignedCenter: 'National Headquarters Command',
      assignedCenterCode: 'HQ-ACC-01',
      dutyStatus: 'ON_DUTY',
      mustChangePassword: false,
      passwordHash: 'Admin@123',
      photo: '/images/waec-logo.jpg',
      lastLoginAt: '27 Oct 2026, 07:30 GMT',
    },
    {
      id: 'usr-field-1',
      staffId: 'WAEC-GH-0412',
      email: 'kmensah@waec.org',
      name: 'Kofi Mensah',
      phone: '+233 24 412 8900',
      pin: '0412',
      role: 'FIELD_OFFICER',
      status: 'ACTIVE',
      region: 'Ashanti Region',
      group: 'Group 1',
      isGroupLeader: true,
      assignedCenter: 'Prempeh College Center A',
      assignedCenterCode: '050102',
      dutyStatus: 'ON_DUTY',
      mustChangePassword: false,
      passwordHash: 'Field@123',
      photo: '',
      lastLoginAt: '27 Oct 2026, 08:15 GMT',
      checkInTime: '08:15 GMT',
    },
    {
      id: 'usr-field-2',
      staffId: 'WAEC-GH-0389',
      email: 'aowusu@waec.org',
      name: 'Akua Owusu',
      phone: '+233 24 100 2345',
      pin: '1234',
      role: 'FIELD_OFFICER',
      status: 'ACTIVE',
      region: 'Ashanti Region',
      group: 'Group 1',
      isGroupLeader: false,
      assignedCenter: 'Prempeh College Center A',
      assignedCenterCode: '050102',
      dutyStatus: 'ON_DUTY',
      mustChangePassword: false,
      passwordHash: 'Field@123',
      photo: '',
      lastLoginAt: '27 Oct 2026, 08:20 GMT',
      checkInTime: '08:20 GMT',
    },
  ]

  // --- User Queries & Mutations ---

  getUsers(): UserAccount[] {
    return this.users
  }

  getFieldOfficers(): UserAccount[] {
    return this.users.filter((u) => u.role === 'FIELD_OFFICER')
  }

  findUser(identifier: string): UserAccount | undefined {
    const clean = identifier.trim().toLowerCase().replace(/\s+/g, '')
    return this.users.find(
      (u) =>
        u.email.toLowerCase() === clean ||
        u.staffId.toLowerCase() === clean ||
        u.phone.replace(/\s+/g, '') === clean ||
        u.id.toLowerCase() === clean
    )
  }

  findOfficerByPhone(phone: string): UserAccount | undefined {
    const digits = phone.replace(/\D/g, '')
    if (!digits) return undefined
    const last9 = digits.length >= 9 ? digits.slice(-9) : digits
    return this.users.find((u) => {
      const uDigits = u.phone.replace(/\D/g, '')
      const uLast9 = uDigits.length >= 9 ? uDigits.slice(-9) : uDigits
      return uLast9 === last9
    })
  }

  findOfficerByPhoneAndPin(phone: string, pin: string): UserAccount | undefined {
    const cleanPin = pin.trim()
    const user = this.findOfficerByPhone(phone)
    if (!user) return undefined
    if (verifyPin(cleanPin, user.pin)) return user
    return undefined
  }

  createUser(officer: Omit<UserAccount, 'id' | 'dutyStatus' | 'mustChangePassword'>): UserAccount {
    const newUser: UserAccount = {
      ...officer,
      pin: hashPin(officer.pin),
      id: `usr-${Date.now()}`,
      dutyStatus: 'OFF_DUTY',
      mustChangePassword: officer.role === 'ADMIN',
    }
    this.users.unshift(newUser)
    return newUser
  }

  updateUserStatus(id: string, status: AccountStatus): UserAccount | undefined {
    const user = this.users.find((u) => u.id === id || u.staffId === id)
    if (user) {
      user.status = status
    }
    return user
  }

  updateUser(id: string, updates: Partial<UserAccount>): UserAccount | undefined {
    const user = this.users.find((u) => u.id === id || u.staffId === id)
    if (user) {
      Object.assign(user, updates)
    }
    return user
  }

  resetUserPassword(id: string, newTempPass: string): UserAccount | undefined {
    const user = this.users.find((u) => u.id === id || u.staffId === id)
    if (user) {
      user.passwordHash = newTempPass
      user.mustChangePassword = true
    }
    return user
  }

  changeUserPassword(id: string, newPassword: string): boolean {
    const user = this.users.find((u) => u.id === id || u.staffId === id)
    if (user) {
      user.passwordHash = newPassword
      user.mustChangePassword = false
      return true
    }
    return false
  }

  toggleDutyStatus(id: string, status: DutyStatus): UserAccount | undefined {
    const user = this.users.find((u) => u.id === id || u.staffId === id)
    if (user) {
      user.dutyStatus = status
      if (status === 'ON_DUTY') {
        user.checkInTime = new Date().toLocaleTimeString('en-GB') + ' GMT'
      }
    }
    return user
  }
}

// Global singleton instance for hot-reloads
const globalForStore = globalThis as unknown as { mosV1Store: MosV1Store | undefined }
export const store = globalForStore.mosV1Store ?? new MosV1Store()
if (process.env.NODE_ENV !== 'production') globalForStore.mosV1Store = store
