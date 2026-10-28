import { NextResponse } from 'next/server'
import { store } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const { userId, newPassword } = await request.json()

    if (!userId || !newPassword || newPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters long' }, { status: 400 })
    }

    const success = store.changeUserPassword(userId, newPassword)

    if (!success) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, message: 'Password updated successfully' })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update password' }, { status: 500 })
  }
}
