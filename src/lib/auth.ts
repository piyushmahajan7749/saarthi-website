// Cookie-session auth using jose JWTs (edge-compatible for middleware.ts).
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import { db } from './db'
import type { SessionUser } from '@/types'

export const SESSION_COOKIE = 'saarthi_session'
const SESSION_DAYS = 7

function secret(): Uint8Array {
  return new TextEncoder().encode(process.env.SESSION_SECRET || 'saarthi-dev-secret-change-me-in-production')
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret())
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret())
    return (payload.user as SessionUser) ?? null
  } catch {
    return null
  }
}

// Server components / route handlers only (uses next/headers).
export async function getSession(): Promise<SessionUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value
  if (!token) return null
  return verifySessionToken(token)
}

// Throws a Response(401) when unauthenticated — use in API routes:
//   const user = await requireUser()
export async function requireUser(): Promise<SessionUser> {
  const user = await getSession()
  if (!user) throw new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } })
  return user
}

export async function login(phone: string, password: string): Promise<SessionUser | null> {
  const digits = phone.replace(/\D/g, '')
  const normalized = digits.length === 10 ? `91${digits}` : digits
  const user = await db.user.findFirst({ where: { phone: { in: [digits, normalized] }, active: true } })
  if (!user?.passwordHash) return null
  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) return null
  return { id: user.id, name: user.name, phone: user.phone, role: user.role as SessionUser['role'] }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}
