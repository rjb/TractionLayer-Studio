import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export default async function HomePage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role === 'APPROVED') {
      redirect('/workflows')
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-950 text-slate-100 p-8 md:p-12">
      <main className="flex flex-1 flex-col items-center justify-center">
        <div className="text-center">
          <p className="text-xs font-mono uppercase tracking-widest text-slate-500 mb-4">
            TRACTIONLAYER // STUDIO
          </p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white max-w-2xl mx-auto">
            Your private AI workspace.
          </h1>
          <p className="text-base sm:text-lg text-slate-400 max-w-xl mt-4 leading-relaxed mx-auto">
            Automation tools designed around your daily workflow. No prompt engineering required—just your business, automated.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-4">
            <Link
              href="/login"
              className="w-full sm:w-auto text-center bg-white text-slate-950 font-semibold px-6 py-3 rounded-lg hover:bg-slate-200 transition"
            >
              Sign in to Studio &rarr;
            </Link>
            <a
              href="https://tractionlayer.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto text-center border border-slate-800 text-slate-300 font-medium px-6 py-3 rounded-lg hover:bg-slate-900 hover:text-white transition"
            >
              Request an Architecture Audit
            </a>
          </div>
        </div>
      </main>
      <footer className="text-xs text-slate-600 text-center mx-auto w-full">
        Secure managed infrastructure. © TractionLayer.
      </footer>
    </div>
  )
}
