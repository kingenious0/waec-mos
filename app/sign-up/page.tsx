import Link from 'next/link'

export default function SignUpPage() {
  return <main className="flex min-h-screen items-center justify-center bg-[#090a0f] px-4 py-10 text-white"><section className="w-full max-w-md rounded-2xl border border-[#22263c] bg-[#11131f] p-6 shadow-2xl"><div className="mb-8 text-[10px] font-bold tracking-[0.22em] text-[#8290ff]">ACCOUNT CREATION RESTRICTED</div><h1 className="mb-2 text-2xl font-black">Contact your administrator</h1><p className="mb-6 text-sm leading-6 text-slate-400">Field officer accounts are created by WAEC MOS administrators. Use the credentials provided to you, then change your password after signing in.</p><Link className="block rounded-lg bg-[#f6d300] px-4 py-3 text-center text-xs font-black tracking-widest text-[#11131f]" href="/sign-in">GO TO SIGN IN</Link></section></main>
}
