'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError('')
    const result = await authClient.signIn.email({ email, password })
    if (result.error) {
      setError('Unable to authenticate. Check your details and try again.')
      setPending(false)
      return
    }
    router.push('/')
    router.refresh()
  }

  return <form onSubmit={submit} className="flex flex-col gap-4">
    <label className="flex flex-col gap-2 text-xs font-bold tracking-wider text-slate-400">EMAIL<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="rounded-lg border border-[#303654] bg-[#15192b] px-3 py-3 text-sm font-normal tracking-normal text-white outline-none focus:border-[#8290ff]" /></label>
    <label className="flex flex-col gap-2 text-xs font-bold tracking-wider text-slate-400">PASSWORD<input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="rounded-lg border border-[#303654] bg-[#15192b] px-3 py-3 text-sm font-normal tracking-normal text-white outline-none focus:border-[#8290ff]" /></label>
    {error && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>}
    <button disabled={pending} className="rounded-lg bg-[#f6d300] px-4 py-3 text-xs font-black tracking-widest text-[#11131f] disabled:opacity-60">{pending ? 'AUTHENTICATING…' : 'SIGN IN TO MOS'}</button>
  </form>
}
