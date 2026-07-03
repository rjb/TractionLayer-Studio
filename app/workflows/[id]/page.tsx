import Link from 'next/link'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getActiveWorkflowForClientTag } from '@/lib/workflows-data'
import WorkflowForm from './WorkflowForm'

export default async function WorkflowPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const session = await auth.api.getSession({ headers: await headers() })

  if (!session) {
    redirect('/login')
  }

  if (session.user.role !== 'APPROVED') {
    redirect('/account-pending')
  }

  const workflow = await getActiveWorkflowForClientTag(id, session.user.client_tag)

  if (!workflow) {
    return (
      <div className="min-h-screen bg-slate-950 p-8 text-white">
        <div className="max-w-md mx-auto bg-slate-900 border border-slate-800 p-8 rounded-xl">
          <nav className="text-sm text-slate-400 mb-6">
            <Link href="/workflows" className="hover:text-white transition-colors">&lsaquo; Workflows</Link>
          </nav>

          <h1 className="text-2xl font-bold mb-6">Workflow not found</h1>
        </div>
      </div>
    )
  }

  return <WorkflowForm workflow={workflow} />
}
