const messageBuckets = new Map();
const loginBuckets = new Map();

const MESSAGE_WINDOW_MS = 10_000;
const MESSAGE_LIMIT = 5;
const LOGIN_WINDOW_MS = 10 * 60_000;
const LOGIN_LIMIT = 10;

function allowWithinWindow(bucketMap, key, { windowMs, limit }) {
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

export function allowMessage(userId) {
  return allowWithinWindow(messageBuckets, String(userId), {
    windowMs: MESSAGE_WINDOW_MS,
    limit: MESSAGE_LIMIT
  });
}

export function allowLoginAttempt({ userId, ip }) {
  const key = `${ip ?? 'unknown'}:${userId ?? 'unknown'}`;
  return allowWithinWindow(loginBuckets, key, {
    windowMs: LOGIN_WINDOW_MS,
    limit: LOGIN_LIMIT
  });
}
