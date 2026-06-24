'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()

  if (pathname === '/login' || pathname === '/') {
    return null
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="sticky top-0 z-50 h-14 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex h-full max-w-5xl items-center justify-between px-4 lg:px-0">
        <Link
          href="/workflows"
          className="text-sm font-semibold tracking-tight text-white hover:text-slate-200 transition-colors"
        >
          TractionLayer Studio
        </Link>

        <nav className="flex items-center gap-6">
          <Link
            href="/workflows"
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            Workflows
          </Link>
          <button
            onClick={handleSignOut}
            className="text-sm text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            Sign Out
          </button>
        </nav>
      </div>
    </header>
  )
}
