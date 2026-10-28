import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db, isLiveDatabase } from '@/lib/db'
import * as schema from '@/lib/db/schema'

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET || 'WKhx9kp89Qkhs8W+s03I4I9ZOjtVW+WLYiqlSDh3Hk0=',
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  database: isLiveDatabase && db ? drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }) : undefined,
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
    requireEmailVerification: false,
  },
  user: {
    additionalFields: {
      staffId: {
        type: 'string',
        required: false,
      },
      role: {
        type: 'string',
        required: true,
        defaultValue: 'FIELD_OFFICER',
      },
      status: {
        type: 'string',
        required: true,
        defaultValue: 'ACTIVE',
      },
      regionId: {
        type: 'string',
        required: false,
      },
      mustChangePassword: {
        type: 'boolean',
        required: true,
        defaultValue: true,
      },
    },
  },
  rateLimit: {
    window: 60,
    max: 10,
  },
})
