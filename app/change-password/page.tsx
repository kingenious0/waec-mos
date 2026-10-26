'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'

export default function ChangePasswordPage() {
  const router = useRouter()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(''); setMessage('')
    const result = await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true })
    if (result.error) setError('The current password could not be verified.')
    else { setMessage('Password changed successfully.'); setCurrentPassword(''); setNewPassword('') }
  }
  return <main className="flex min-h-screen items-center justify-center bg-[#090a0f] px-4 text-white"><form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-[#22263c] bg-[#11131f] p-6"><p className="text-[10px] font-bold tracking-[0.22em] text-[#8290ff]">WAEC MOS / SECURITY</p><h1 className="mt-3 text-2xl font-black">Change password</h1><p className="mt-2 mb-6 text-sm text-slate-400">Update your field account password securely.</p><label className="mb-4 flex flex-col gap-2 text-[10px] font-bold tracking-widest text-slate-400">CURRENT PASSWORD<input required type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="rounded-lg border border-[#303654] bg-[#15192b] px-3 py-3 text-sm tracking-normal text-white" /></label><label className="mb-4 flex flex-col gap-2 text-[10px] font-bold tracking-widest text-slate-400">NEW PASSWORD<input required minLength={8} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="rounded-lg border border-[#303654] bg-[#15192b] px-3 py-3 text-sm tracking-normal text-white" /></label>{error && <p className="mb-3 text-xs text-red-300">{error}</p>}{message && <p className="mb-3 text-xs text-emerald-300">{message}</p>}<button className="w-full rounded-lg bg-[#f6d300] px-4 py-3 text-xs font-black tracking-widest text-[#11131f]">UPDATE PASSWORD</button><button type="button" onClick={() => router.back()} className="mt-3 w-full text-xs text-slate-400">GO BACK</button></form></main>
}
