import { createClient } from 'redis';

const MESSAGE_WINDOW_MS = 10_000;
const MESSAGE_LIMIT = 5;
const LOGIN_WINDOW_MS = 10 * 60_000;
const LOGIN_LIMIT = 10;
const SIGNUP_WINDOW_MS = 10 * 60_000;
const SIGNUP_LIMIT = 5;
const USER_LOOKUP_WINDOW_MS = 60_000;
const USER_LOOKUP_LIMIT = 60;

export async function createRateLimiter({ redisUrl, required = false, prefix = 'chatfr:rate-limit' } = {}) {
  const strict = required || process.env.NODE_ENV === 'production';
  const memoryLimiter = createMemoryRateLimiter();

  if (!redisUrl) {
    if (strict) {
      throw new Error('REDIS_URL is required when RATE_LIMIT_STORE=redis');
    }

    return memoryLimiter;
  }

  const client = createClient({ url: redisUrl });

  try {
    await client.connect();
  } catch (error) {
    if (strict) {
      throw error;
    }

    try {
      await client.disconnect();
    } catch {
    }

    console.warn('Redis rate limiting is unavailable; using in-memory limits.', error);
    return memoryLimiter;
  }

  client.on('error', (error) => {
    console.warn('Redis rate limiter error.', error);
  });

  return {
    store: 'redis',
    allowMessage: (userId) => allowRedis(client, `${prefix}:message:${keyPart(userId)}`, {
      windowMs: MESSAGE_WINDOW_MS,
      limit: MESSAGE_LIMIT
    }, () => memoryLimiter.allowMessage(userId)),
    allowLoginAttempt: ({ userId, ip }) => allowRedis(client, `${prefix}:login:${keyPart(ip)}:${keyPart(userId)}`, {
      windowMs: LOGIN_WINDOW_MS,
      limit: LOGIN_LIMIT
    }, () => memoryLimiter.allowLoginAttempt({ userId, ip })),
    allowSignupAttempt: (ip) => allowRedis(client, `${prefix}:signup:${keyPart(ip)}`, {
      windowMs: SIGNUP_WINDOW_MS,
      limit: SIGNUP_LIMIT
    }, () => memoryLimiter.allowSignupAttempt(ip)),
    allowUserLookup: ({ userId, ip }) => allowRedis(client, `${prefix}:user-lookup:${keyPart(ip)}:${keyPart(userId)}`, {
      windowMs: USER_LOOKUP_WINDOW_MS,
      limit: USER_LOOKUP_LIMIT
    }, () => memoryLimiter.allowUserLookup({ userId, ip })),
    close: () => client.quit()
  };
}

export function createMemoryRateLimiter() {
  const messageBuckets = new Map();
  const loginBuckets = new Map();
  const signupBuckets = new Map();
  const userLookupBuckets = new Map();

  return {
    store: 'memory',
    allowMessage: (userId) => allowMemory(messageBuckets, keyPart(userId), {
      windowMs: MESSAGE_WINDOW_MS,
      limit: MESSAGE_LIMIT
    }),
    allowLoginAttempt: ({ userId, ip }) => allowMemory(loginBuckets, `${keyPart(ip)}:${keyPart(userId)}`, {
      windowMs: LOGIN_WINDOW_MS,
      limit: LOGIN_LIMIT
    }),
    allowSignupAttempt: (ip) => allowMemory(signupBuckets, keyPart(ip), {
      windowMs: SIGNUP_WINDOW_MS,
      limit: SIGNUP_LIMIT
    }),
    allowUserLookup: ({ userId, ip }) => allowMemory(userLookupBuckets, `${keyPart(ip)}:${keyPart(userId)}`, {
      windowMs: USER_LOOKUP_WINDOW_MS,
      limit: USER_LOOKUP_LIMIT
    }),
    close: async () => {}
  };
}

async function allowRedis(client, key, { windowMs, limit }, fallback) {
  try {
    const count = await client.incr(key);

    if (count === 1) {
      await client.pExpire(key, windowMs);
    }

    return count <= limit;
  } catch (error) {
    console.warn('Redis rate limit check failed; falling back to in-memory limit.', error);
    return fallback();
  }
}

function allowMemory(bucketMap, key, { windowMs, limit }) {
  const now = Date.now();
  const recent = bucketMap.get(key)?.filter((timestamp) => now - timestamp < windowMs) ?? [];

  if (recent.length >= limit) {
    bucketMap.set(key, recent);
    return false;
  }

  recent.push(now);
  bucketMap.set(key, recent);
  return true;
}

function keyPart(value) {
  return encodeURIComponent(String(value ?? 'unknown'));
}
