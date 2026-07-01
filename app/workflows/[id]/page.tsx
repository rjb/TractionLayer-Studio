import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getProfile } from '@/lib/profile'
import { getActiveWorkflowForClientTag } from '@/lib/workflows-data'
import WorkflowForm from './WorkflowForm'

export default async function WorkflowPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect('/login')
  }

  const profile = await getProfile(supabase, user.id)

  if (!profile || profile.role !== 'APPROVED') {
    redirect('/account-pending')
  }

  const workflow = await getActiveWorkflowForClientTag(supabase, id, profile.client_tag)

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
