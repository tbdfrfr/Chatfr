import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export function assertEnv() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required');
  }
}

export function signToken(userId) {
  return jwt.sign({ sub: String(userId) }, process.env.JWT_SECRET, { expiresIn: '14d' });
}

export function verifyToken(token) {
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  return Number(payload.sub);
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
