import type { SupabaseClient } from '@supabase/supabase-js'
import type { WorkflowRow } from '@/lib/workflows'

export async function getActiveWorkflowsForClientTag(
  supabase: SupabaseClient,
  clientTag: string
): Promise<WorkflowRow[]> {
  const { data, error } = await supabase
    .from('workflows')
    .select('*')
    .eq('client_tag', clientTag)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`Failed to load workflows: ${error.message}`)
  }

  return (data ?? []) as WorkflowRow[]
}

export async function getActiveWorkflowForClientTag(
  supabase: SupabaseClient,
  id: string,
  clientTag: string
): Promise<WorkflowRow | null> {
  const { data, error } = await supabase
    .from('workflows')
    .select('*')
    .eq('id', id)
    .eq('client_tag', clientTag)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load workflow: ${error.message}`)
  }

  return (data as WorkflowRow | null) ?? null
}
