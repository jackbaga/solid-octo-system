import crypto from 'crypto';
import { prisma } from '../prisma/client.js';

const tokenSecret = process.env.AUTH_SECRET || 'vol-man-system-local-secret';
const tokenTtlMs = 7 * 24 * 60 * 60 * 1000;

function base64Url(input: Buffer | string) {
  return Buffer.from(input).toString('base64url');
}

function signPayload(payload: string) {
  return crypto.createHmac('sha256', tokenSecret).update(payload).digest('base64url');
}

function hashPassword(password: string, salt = crypto.randomBytes(16).toString('base64url')) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, 'sha256').toString('base64url');
  return `${salt}.${hash}`;
}

function verifyPassword(password: string, passwordHash: string) {
  const [salt] = passwordHash.split('.');
  return hashPassword(password, salt) === passwordHash;
}

export function createToken(user: { id: number; username: string }) {
  const payload = base64Url(JSON.stringify({
    sub: user.id,
    username: user.username,
    exp: Date.now() + tokenTtlMs
  }));
  return `${payload}.${signPayload(payload)}`;
}

export function verifyToken(token: string) {
  const [payload, signature] = token.split('.');

  if (!payload || !signature || signPayload(payload) !== signature) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      sub?: number;
      username?: string;
      exp?: number;
    };

    if (!decoded.sub || !decoded.username || !decoded.exp || decoded.exp < Date.now()) {
      return null;
    }

    return { id: decoded.sub, username: decoded.username };
  } catch {
    return null;
  }
}

export async function registerUser(username: string, password: string) {
  const user = await prisma.user.create({
    data: {
      username,
      passwordHash: hashPassword(password)
    },
    select: { id: true, username: true }
  });

  return {
    user,
    token: createToken(user)
  };
}

export async function loginUser(username: string, password: string) {
  const user = await prisma.user.findUnique({ where: { username } });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return null;
  }

  const publicUser = { id: user.id, username: user.username };
  return {
    user: publicUser,
    token: createToken(publicUser)
  };
}
