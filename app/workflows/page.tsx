import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getActiveWorkflowsForClientTag } from '@/lib/workflows-data'

export default async function WorkflowsPage() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session) {
    redirect('/login')
  }

  if (session.user.role !== 'APPROVED') {
    redirect('/account-pending')
  }

  const workflows = await getActiveWorkflowsForClientTag(session.user.client_tag)

  return (
    <div className="min-h-screen bg-slate-950 p-8 text-white">
      <div className="max-w-5xl mx-auto">
        <header className="mb-12">
          <h1 className="text-3xl font-bold">AI Workflows</h1>
          <p className="text-slate-400">Welcome back, {session.user.email}</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {workflows.map((wf) => (
            <a
              key={wf.id}
              href={`/workflows/${wf.id}`}
              className="block bg-slate-900 p-6 rounded-xl border border-slate-800 hover:border-blue-500 cursor-pointer transition-all hover:-translate-y-1"
            >
              <h2 className="text-lg font-semibold mb-2">{wf.name}</h2>
              <p className="text-sm text-slate-400">{wf.description}</p>
            </a>
          ))}
        </div>

        {workflows.length === 0 && (
          <p className="text-slate-500">No workflows are configured for your account yet.</p>
        )}
      </div>
    </div>
  )
}
