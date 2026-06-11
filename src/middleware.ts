import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const SESSION_COOKIE = 'saarthi_session'

// Protect /admin pages (except login) and /api/admin routes.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (pathname === '/admin/login') return NextResponse.next()

  const token = req.cookies.get(SESSION_COOKIE)?.value
  const user = token ? await verify(token) : null

  if (!user) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const url = req.nextUrl.clone()
    url.pathname = '/admin/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

async function verify(token: string) {
  try {
    const secret = new TextEncoder().encode(process.env.SESSION_SECRET || 'saarthi-dev-secret-change-me-in-production')
    const { payload } = await jwtVerify(token, secret)
    return payload.user ?? null
  } catch {
    return null
  }
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
}
