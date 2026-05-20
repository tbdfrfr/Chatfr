import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const DEFAULT_JWT_EXPIRES_IN = '4h';
const DEFAULT_SESSION_MAX_AGE_SECONDS = 4 * 60 * 60;
const DEFAULT_JWT_ISSUER = 'chatfr';
const DEFAULT_JWT_AUDIENCE = 'chatfr-web';
const DEFAULT_SESSION_VERSION = 0;
const DEFAULT_CSRF_EXPIRES_IN = DEFAULT_JWT_EXPIRES_IN;
export const SESSION_COOKIE_NAME = 'chatfr.session';

export function assertEnv() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required');
  }

  if (process.env.NODE_ENV === 'production') {
    if (process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET === 'change-me-in-production') {
      throw new Error('JWT_SECRET must be at least 32 characters in production');
    }

    if (!process.env.CLIENT_ORIGIN) {
      throw new Error('CLIENT_ORIGIN is required in production');
    }
  }

  if (getSessionSameSite() === 'None' && !getSessionSecure()) {
    throw new Error('SESSION_COOKIE_SAMESITE=None requires SESSION_COOKIE_SECURE=true');
  }
}

export function signToken(userId, sessionVersion = DEFAULT_SESSION_VERSION) {
  return jwt.sign({ sub: String(userId), sv: normalizeSessionVersion(sessionVersion) }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || DEFAULT_JWT_EXPIRES_IN,
    issuer: process.env.JWT_ISSUER || DEFAULT_JWT_ISSUER,
    audience: process.env.JWT_AUDIENCE || DEFAULT_JWT_AUDIENCE
  });
}

export function verifyToken(token) {
  const payload = jwt.verify(token, process.env.JWT_SECRET, {
    issuer: process.env.JWT_ISSUER || DEFAULT_JWT_ISSUER,
    audience: process.env.JWT_AUDIENCE || DEFAULT_JWT_AUDIENCE
  });
  return {
    userId: Number(payload.sub),
    sessionVersion: normalizeSessionVersion(payload.sv)
  };
}

export function normalizeVerifiedToken(value) {
  if (typeof value === 'number') {
    return { userId: value, sessionVersion: DEFAULT_SESSION_VERSION };
  }

  if (value && typeof value === 'object') {
    const userId = Number(value.userId ?? value.sub ?? value.id);
    return {
      userId,
      sessionVersion: normalizeSessionVersion(value.sessionVersion ?? value.sv)
    };
  }

  return { userId: Number(value), sessionVersion: DEFAULT_SESSION_VERSION };
}

export function signCsrfToken() {
  return jwt.sign({ typ: 'csrf', nonce: crypto.randomBytes(32).toString('base64url') }, process.env.JWT_SECRET, {
    expiresIn: process.env.CSRF_TOKEN_EXPIRES_IN || DEFAULT_CSRF_EXPIRES_IN,
    issuer: process.env.JWT_ISSUER || DEFAULT_JWT_ISSUER,
    audience: process.env.JWT_AUDIENCE || DEFAULT_JWT_AUDIENCE
  });
}

export function verifyCsrfToken(token) {
  const payload = jwt.verify(token, process.env.JWT_SECRET, {
    issuer: process.env.JWT_ISSUER || DEFAULT_JWT_ISSUER,
    audience: process.env.JWT_AUDIENCE || DEFAULT_JWT_AUDIENCE
  });

  if (payload.typ !== 'csrf') {
    throw new Error('Invalid CSRF token');
  }

  return true;
}

export function getCsrfTokenFromRequest(request) {
  const token = request.headers['x-csrf-token'] ?? request.headers['x-xsrf-token'];

  if (typeof token === 'string') {
    return token;
  }

  return null;
}

export function getRequestToken(request) {
  const header = request.headers.authorization;

  if (header?.startsWith('Bearer ')) {
    return header.slice(7);
  }

  return getSessionTokenFromCookieHeader(request.headers.cookie);
}

export function getSessionTokenFromCookieHeader(cookieHeader) {
  if (typeof cookieHeader !== 'string') {
    return null;
  }

  const cookieName = `${SESSION_COOKIE_NAME}=`;
  const cookie = cookieHeader
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(cookieName));

  if (!cookie) {
    return null;
  }

  try {
    return decodeURIComponent(cookie.slice(cookieName.length));
  } catch {
    return null;
  }
}

export function setSessionCookie(reply, token) {
  reply.header('Set-Cookie', serializeSessionCookie(token, {
    maxAge: getSessionMaxAgeSeconds(),
    sameSite: getSessionSameSite(),
    secure: getSessionSecure()
  }));
}

export function clearSessionCookie(reply) {
  reply.header('Set-Cookie', serializeSessionCookie('', {
    maxAge: 0,
    sameSite: getSessionSameSite(),
    secure: getSessionSecure()
  }));
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function normalizeDisplayName(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed.slice(0, 40) : null;
}

function serializeSessionCookie(value, { maxAge, sameSite, secure }) {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(value)}`,
    'HttpOnly',
    'Path=/',
    `Max-Age=${maxAge}`,
    `SameSite=${sameSite}`
  ];

  if (secure) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

function getSessionMaxAgeSeconds() {
  const configured = Number(process.env.SESSION_COOKIE_MAX_AGE_SECONDS);
  return Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_SESSION_MAX_AGE_SECONDS;
}

function getSessionSameSite() {
  const value = String(process.env.SESSION_COOKIE_SAMESITE || 'Lax').trim().toLowerCase();

  if (value === 'strict') {
    return 'Strict';
  }

  if (value === 'none') {
    return 'None';
  }

  return 'Lax';
}

function getSessionSecure() {
  if (process.env.SESSION_COOKIE_SECURE === 'true') {
    return true;
  }

  if (process.env.SESSION_COOKIE_SECURE === 'false') {
    return false;
  }

  return process.env.NODE_ENV === 'production';
}

function normalizeSessionVersion(value) {
  const sessionVersion = Number(value);
  return Number.isInteger(sessionVersion) && sessionVersion >= 0 ? sessionVersion : DEFAULT_SESSION_VERSION;
}
