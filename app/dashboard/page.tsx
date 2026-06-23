'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// Hardcoded workflow registry for our MVP v1
const WORKFLOWS = [
  { id: 'substack-to-blog', name: 'Substack to Blog', desc: 'Converts Substack drafts to SEO blog posts.' },
  { id: 'meeting-summary', name: 'Meeting Summarizer', desc: 'Transcribes audio to meeting minutes.' },
  { id: 'content-distributor', name: 'Content Distributor', desc: 'Pushes content to multiple social channels.' },
  { id: 'substack-to-blog-NEW', name: 'Substack to Blog NEW', desc: 'Converts Substack drafts to SEO blog posts.' }
]

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/login')
      } else {
        setUser(session.user)
      }
    })
  }, [router])

  if (!user) return <div className="p-8 text-white">Loading...</div>

  return (
    <div className="min-h-screen bg-slate-950 p-8 text-white">
      <div className="max-w-5xl mx-auto">
        <header className="mb-12">
          <h1 className="text-3xl font-bold">Studio</h1>
          <p className="text-slate-400">Welcome back, {user.email}</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {WORKFLOWS.map((wf) => (
            <div
              key={wf.id}
              onClick={() => router.push(`/workflows/${wf.id}`)}
              className="bg-slate-900 p-6 rounded-xl border border-slate-800 hover:border-blue-500 cursor-pointer transition-all hover:-translate-y-1"
            >
              <h2 className="text-lg font-semibold mb-2">{wf.name}</h2>
              <p className="text-sm text-slate-400">{wf.text || wf.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
