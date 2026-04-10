const buckets = new Map();

export function allowMessage(userId) {
  const now = Date.now();
  const windowMs = 10_000;
  const limit = 5;

  const recent = buckets.get(userId)?.filter((timestamp) => now - timestamp < windowMs) ?? [];

  if (recent.length >= limit) {
    buckets.set(userId, recent);
    return false;
  }

  recent.push(now);
  buckets.set(userId, recent);
  return true;
}
