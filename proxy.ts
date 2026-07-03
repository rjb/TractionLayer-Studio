import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export async function proxy(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  })

  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (session.user.role !== 'APPROVED') {
    return NextResponse.redirect(new URL('/account-pending', request.url))
  }

  return NextResponse.next({
    request: {
      headers: request.headers,
    },
  })
}

export const config = {
  matcher: ['/workflows/:path*'],
}
