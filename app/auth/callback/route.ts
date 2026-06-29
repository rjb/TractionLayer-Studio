import { createRouteHandlerSupabaseClient } from '@/lib/supabase-server'
import { type NextRequest, NextResponse } from 'next/server'

function getPublicOrigin(request: Request, fallbackOrigin: string): string {
  const forwardedHost = request.headers.get('x-forwarded-host')
  if (forwardedHost) {
    const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https'
    return `${forwardedProto}://${forwardedHost}`
  }
  return fallbackOrigin
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = getPublicOrigin(request, requestUrl.origin)

  if (code) {
    const response = NextResponse.redirect(`${origin}/workflows`)
    const supabase = createRouteHandlerSupabaseClient(request, response)
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return response
    }
  }

  return NextResponse.redirect(`${origin}/login`)
}
