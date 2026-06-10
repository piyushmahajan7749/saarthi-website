import { NextResponse } from 'next/server'
import { login, createSessionToken, SESSION_COOKIE } from '@/lib/auth'

export async function POST(req: Request) {
  const { phone, password } = await req.json().catch(() => ({}))
  if (!phone || !password) {
    return NextResponse.json({ error: 'Phone and password are required' }, { status: 400 })
  }
  const user = await login(String(phone), String(password))
  if (!user) {
    return NextResponse.json({ error: 'Invalid phone or password' }, { status: 401 })
  }
  const token = await createSessionToken(user)
  const res = NextResponse.json({ user })
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
  return res
}
