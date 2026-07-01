import type { SupabaseClient } from '@supabase/supabase-js'

export type Profile = {
  role: string
  client_tag: string
}

export async function getProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('role, client_tag')
    .eq('id', userId)
    .single()

  if (error || !data) return null

  return data as Profile
}
