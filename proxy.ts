import { type NextRequest, NextResponse } from 'next/server'
import { createProxySupabaseClient } from '@/lib/supabase-server'

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createProxySupabaseClient(request, response)

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile || profile.role !== 'APPROVED') {
    return NextResponse.redirect(new URL('/account-pending', request.url))
  }

  return response
}

export const config = {
  matcher: ['/workflows/:path*'],
}
