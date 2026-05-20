import dotenv from 'dotenv';
import { createPool } from './db.js';
import { ensureSchema } from './schema.js';
import {
  assertEnv,
  verifyToken
} from './auth.js';
import { createDomainServices } from './domainServices.js';
import { createApp } from './app.js';
import { registerWebsocketServer } from './realtime/websocket.js';
import { createRateLimiter } from './rateLimit.js';
import { toUserPayload } from './userPayload.js';

dotenv.config();
assertEnv();

const pool = createPool();
const clients = new Map();
const domainServices = createDomainServices({ pool, clientOrigin: process.env.CLIENT_ORIGIN, clients });
const { isAllowedWebSocketOrigin, seedTbdAccountProfilePicture } = domainServices;
const useRedisRateLimit = process.env.RATE_LIMIT_STORE === 'redis'
  || (Boolean(process.env.REDIS_URL) && process.env.RATE_LIMIT_STORE !== 'memory');
const rateLimiter = await createRateLimiter({
  redisUrl: useRedisRateLimit ? process.env.REDIS_URL : undefined,
  required: process.env.RATE_LIMIT_STORE === 'redis'
});

await ensureSchema(pool);
await seedTbdAccountProfilePicture();

const app = await createApp({
  pool,
  domainServices,
  toUserPayload,
  verifyToken,
  rateLimiter,
  clientOrigin: process.env.CLIENT_ORIGIN,
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  requireHttps: process.env.REQUIRE_HTTPS === 'true'
});

registerWebsocketServer(app.server, {
  clients,
  isAllowedWebSocketOrigin,
  verifyToken,
  getUser: domainServices.getUser
});

const port = Number(process.env.PORT || 3001);
await app.listen({ port, host: '0.0.0.0' });

function parseTrustProxy(value) {
  if (!value || value === 'false') {
    return false;
  }

  if (value === 'true') {
    return true;
  }

  const numeric = Number(value);
  if (Number.isInteger(numeric) && numeric >= 0) {
    return numeric;
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
