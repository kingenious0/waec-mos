/**
 * SMS gateway adapter. Select the provider with SMS_PROVIDER=frog|wigal|sailup
 * (or leave unset for a safe development logger — no SMS is sent and the code
 * is printed to the server log only, never to the client).
 *
 * All three providers are implemented with their documented API shapes.
 * Endpoints are best-effort from public documentation — confirm the exact
 * URL/credentials when real API keys are issued. To test the full flow
 * today without keys, leave SMS_PROVIDER unset (log mode).
 */

import crypto from 'crypto'

type Provider = 'frog' | 'wigal' | 'sailup' | 'log'

export interface SmsResult {
  ok: boolean
  provider: Provider
  error?: string
}

const PEPPER = (process.env.AUTH_PEPPER || '').trim()

export function hashSmsCode(code: string): string {
  return crypto.createHash('sha256').update(`${PEPPER}:sms:${code}`).digest('hex')
}

export function generateCode(): string {
  return String(crypto.randomInt(100000, 1000000))
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('233')) return `+${digits}`
  if (digits.startsWith('0')) return `+233${digits.slice(1)}`
  return `+${digits}`
}

function obsc(phone: string): string {
  const n = normalizePhone(phone)
  return n.replace(/\d(?=\d{3})/g, '•')
}

// ---------- Providers ----------

async function sendLogSms(phone: string, message: string): Promise<SmsResult> {
  console.warn(
    `[sms] SMS_PROVIDER not set — logging SMS instead of sending to ${obsc(phone)}: "${message}"`
  )
  return { ok: true, provider: 'log' }
}

// Frog SMS (frog.dev) — Bearer-token JSON gateway
async function sendFrogSms(phone: string, message: string): Promise<SmsResult> {
  const apiKey = process.env.FROG_API_KEY
  const senderId = process.env.FROG_SENDER_ID || 'WAEC'
  const baseUrl = process.env.FROG_BASE_URL || 'https://api.frogapi.com/v1'

  if (!apiKey) {
    console.warn('[sms] SMS_PROVIDER=frog but FROG_API_KEY is not set — falling back to log mode')
    return sendLogSms(phone, message)
  }

  try {
    const res = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: senderId,
        to: normalizePhone(phone),
        text: message,
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { ok: false, provider: 'frog', error: `Frog API ${res.status}: ${body.slice(0, 200)}` }
    }
    return { ok: true, provider: 'frog' }
  } catch (err: any) {
    return { ok: false, provider: 'frog', error: err?.message || 'Frog request failed' }
  }
}

// Wigal SMS (wigal.com.gh) — JSON POST with apiKey + credentials
async function sendWigalSms(phone: string, message: string): Promise<SmsResult> {
  const apiKey = process.env.WIGAL_API_KEY
  const username = process.env.WIGAL_USERNAME
  const password = process.env.WIGAL_PASSWORD
  const senderId = process.env.WIGAL_SENDER_ID || 'WAEC'
  const baseUrl = process.env.WIGAL_BASE_URL || 'https://ws.wigal.com.gh:8080/api/json'

  if (!apiKey || !username || !password) {
    console.warn('[sms] SMS_PROVIDER=wigal but credentials are missing — falling back to log mode')
    return sendLogSms(phone, message)
  }

  try {
    const res = await fetch(`${baseUrl}/sms/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apikey: apiKey,
        username,
        password,
        from: senderId,
        to: normalizePhone(phone),
        message,
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { ok: false, provider: 'wigal', error: `Wigal API ${res.status}: ${body.slice(0, 200)}` }
    }
    return { ok: true, provider: 'wigal' }
  } catch (err: any) {
    return { ok: false, provider: 'wigal', error: err?.message || 'Wigal request failed' }
  }
}

// Sailup (sailup.com) — JSON POST with API key; endpoint configurable
async function sendSailupSms(phone: string, message: string): Promise<SmsResult> {
  const apiKey = process.env.SAILUP_API_KEY
  const senderId = process.env.SAILUP_SENDER_ID || 'WAEC'
  const baseUrl = process.env.SAILUP_BASE_URL || 'https://api.sailup.com'
  const sendPath = process.env.SAILUP_SEND_PATH || '/v1/sms/send'

  if (!apiKey) {
    console.warn('[sms] SMS_PROVIDER=sailup but SAILUP_API_KEY is not set — falling back to log mode')
    return sendLogSms(phone, message)
  }

  try {
    const res = await fetch(`${baseUrl}${sendPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        sender: senderId,
        recipient: normalizePhone(phone),
        message,
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { ok: false, provider: 'sailup', error: `Sailup API ${res.status}: ${body.slice(0, 200)}` }
    }
    return { ok: true, provider: 'sailup' }
  } catch (err: any) {
    return { ok: false, provider: 'sailup', error: err?.message || 'Sailup request failed' }
  }
}

function currentProvider(): Provider {
  const raw = (process.env.SMS_PROVIDER || 'log').trim().toLowerCase()
  if (raw === 'frog' || raw === 'wigal' || raw === 'sailup') return raw
  if (raw === 'log') return 'log'
  console.warn(`[sms] Unknown SMS_PROVIDER "${raw}" — falling back to log mode`)
  return 'log'
}

export async function sendSms(to: string, message: string): Promise<SmsResult> {
  switch (currentProvider()) {
    case 'frog':
      return sendFrogSms(to, message)
    case 'wigal':
      return sendWigalSms(to, message)
    case 'sailup':
      return sendSailupSms(to, message)
    default:
      return sendLogSms(to, message)
  }
}

/** Compose the standard 2FA message. Never include anything sensitive. */
export function smsCodeMessage(code: string): string {
  return `Your WAEC MOS security code is ${code}. It expires in 5 minutes. Never share it.`
}

export function configuredProvider(): Provider {
  return currentProvider()
}
