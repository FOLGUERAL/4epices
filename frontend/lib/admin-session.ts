import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Session admin côté serveur.
 *
 * Le secret (ADMIN_SECRET) ne quitte jamais le serveur : le navigateur reçoit uniquement un cookie
 * HttpOnly signé « expiration.signature ». Ne jamais importer ce fichier depuis un composant client.
 */

export const ADMIN_COOKIE = 'admin_session';
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function getAdminSecret(): string {
  return process.env.ADMIN_SECRET?.trim() || '';
}

export function isAdminConfigured(): boolean {
  return getAdminSecret() !== '';
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

// Comparaison à temps constant (les empreintes ont toujours la même longueur)
function safeEqual(a: string, b: string): boolean {
  const hashA = createHash('sha256').update(a).digest();
  const hashB = createHash('sha256').update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

export function verifyAdminSecret(provided: string): boolean {
  const secret = getAdminSecret();
  return secret !== '' && safeEqual(provided, secret);
}

export function createSessionToken(): string {
  const expires = Date.now() + SESSION_TTL_MS;
  return `${expires}.${sign(`admin:${expires}`, getAdminSecret())}`;
}

function isValidSessionToken(token: string | undefined | null): boolean {
  const secret = getAdminSecret();
  if (!secret || !token) return false;

  const [expires, signature] = token.split('.');
  if (!expires || !signature || !/^\d+$/.test(expires)) return false;
  if (Number(expires) < Date.now()) return false;

  return safeEqual(signature, sign(`admin:${expires}`, secret));
}

export function isAdminRequest(request: NextRequest): boolean {
  return isValidSessionToken(request.cookies.get(ADMIN_COOKIE)?.value);
}

/** Retourne une réponse 401 si la requête n'est pas admin, sinon null. */
export function requireAdmin(request: NextRequest): NextResponse | null {
  if (isAdminRequest(request)) return null;
  return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: SESSION_TTL_MS / 1000,
};
