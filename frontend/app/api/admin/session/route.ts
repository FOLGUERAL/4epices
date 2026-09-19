import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_COOKIE,
  createSessionToken,
  isAdminConfigured,
  isAdminRequest,
  sessionCookieOptions,
  verifyAdminSecret,
} from '@/lib/admin-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Limite les tentatives de connexion par IP (mémoire du process : suffisant pour une instance unique)
const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const failedAttempts = new Map<string, { count: number; resetAt: number }>();

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

function isRateLimited(ip: string): boolean {
  const entry = failedAttempts.get(ip);
  if (!entry) return false;
  if (entry.resetAt < Date.now()) {
    failedAttempts.delete(ip);
    return false;
  }
  return entry.count >= MAX_FAILED_ATTEMPTS;
}

function registerFailure(ip: string) {
  const now = Date.now();
  const entry = failedAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    failedAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

/** État de la session courante. */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    configured: isAdminConfigured(),
    authenticated: isAdminRequest(request),
  });
}

/** Connexion : vérifie le secret côté serveur et pose le cookie de session. */
export async function POST(request: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'ADMIN_SECRET non configuré côté serveur' }, { status: 500 });
  }

  const ip = getClientIp(request);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Trop de tentatives. Réessayez dans quelques minutes.' },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const secret = typeof body?.secret === 'string' ? body.secret : '';

  if (!verifyAdminSecret(secret)) {
    registerFailure(ip);
    return NextResponse.json({ error: 'Secret incorrect' }, { status: 401 });
  }

  failedAttempts.delete(ip);
  const response = NextResponse.json({ authenticated: true });
  response.cookies.set(ADMIN_COOKIE, createSessionToken(), sessionCookieOptions);
  return response;
}

/** Déconnexion. */
export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(ADMIN_COOKIE, '', { ...sessionCookieOptions, maxAge: 0 });
  return response;
}
