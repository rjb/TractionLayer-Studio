import { createBrowserClient } from '@supabase/ssr'
import type { CookieOptionsWithName } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function getCookie(name: string) {
  if (typeof document === 'undefined') return undefined
  const match = document.cookie.match(
    new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)')
  )
  return match ? decodeURIComponent(match[1]) : undefined
}

function setCookie(name: string, value: string, options: CookieOptionsWithName) {
  if (typeof document === 'undefined') return
  const parts = [`${name}=${encodeURIComponent(value)}`]
  if (options.path) parts.push(`path=${options.path}`)
  if (options.maxAge !== undefined) parts.push(`max-age=${options.maxAge}`)
  if (options.expires) parts.push(`expires=${options.expires.toUTCString()}`)
  if (options.domain) parts.push(`domain=${options.domain}`)
  if (options.sameSite) parts.push(`samesite=${options.sameSite}`)
  if (options.secure) parts.push('secure')
  document.cookie = parts.join('; ')
}

function removeCookie(name: string, options: CookieOptionsWithName) {
  setCookie(name, '', { ...options, maxAge: 0 })
}

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  cookies: {
    get: getCookie,
    set: setCookie,
    remove: removeCookie,
  },
})
