import Fastify from 'fastify';
import cors from '@fastify/cors';
import { authRoutes } from './routes/auth.js';
import { userRoutes } from './routes/users.js';
import { threadRoutes } from './routes/threads.js';
import { getRequestToken, getCsrfTokenFromRequest, normalizeVerifiedToken, verifyCsrfToken } from './auth.js';
import { createMemoryRateLimiter } from './rateLimit.js';

const DEFAULT_BODY_LIMIT = 64 * 1024;

export async function createApp({
  pool,
  domainServices,
  toUserPayload,
  verifyToken,
  rateLimiter = createMemoryRateLimiter(),
  clientOrigin,
  trustProxy = false,
  requireHttps = false,
  logger = true,
  bodyLimit = DEFAULT_BODY_LIMIT
}) {
  const app = Fastify({
    bodyLimit,
    logger,
    trustProxy
  });
  const {
    canAccessThread,
    joinGlobal,
    getUser,
    listThreads,
    getThreadById,
    leaveThread,
    getThreadRow,
    getOrCreateDmThread,
    hydrateMessage,
    formatMessage,
    broadcastThreadUpdate,
    broadcastUserUpdate
  } = domainServices;

  app.decorate('authenticate', async (request, reply) => {
    const token = getRequestToken(request);

    if (!token) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      const verified = normalizeVerifiedToken(verifyToken(token));

      if (!Number.isInteger(verified.userId)) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const user = await getUser(verified.userId);

      if (!user || Number(user.session_version ?? 0) !== verified.sessionVersion) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      request.userId = verified.userId;
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  app.decorate('requireCsrf', async (request, reply) => {
    const token = getCsrfTokenFromRequest(request);

    if (!token) {
      return reply.code(403).send({ error: 'Invalid CSRF token.' });
    }

    try {
      verifyCsrfToken(token);
    } catch {
      return reply.code(403).send({ error: 'Invalid CSRF token.' });
    }
  });

  app.addHook('onRequest', async (request, reply) => {
    if (requireHttps && request.protocol !== 'https') {
      return reply.code(426).send({ error: 'HTTPS is required.' });
    }
  });

  await app.register(cors, {
    origin: createCorsOrigin(clientOrigin),
    credentials: true
  });

  app.setErrorHandler((error, request, reply) => {
    if (error.validation) {
      return reply.code(400).send({ error: 'Invalid request.' });
    }

    request.log.error({ err: error });
    return reply.code(error.statusCode && error.statusCode < 500 ? error.statusCode : 500).send({
      error: error.statusCode && error.statusCode < 500 ? error.message : 'Internal server error.'
    });
  });

  app.addHook('onSend', async (_request, reply, payload) => {
    if (!reply.hasHeader('X-Content-Type-Options')) {
      reply.header('X-Content-Type-Options', 'nosniff');
    }

    if (!reply.hasHeader('Content-Security-Policy')) {
      reply.header('Content-Security-Policy', "default-src 'self'; base-uri 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' ws: wss:; frame-ancestors 'none'; form-action 'self'");
    }

    if (!reply.hasHeader('X-Frame-Options')) {
      reply.header('X-Frame-Options', 'DENY');
    }

    if (!reply.hasHeader('Referrer-Policy')) {
      reply.header('Referrer-Policy', 'no-referrer');
    }

    if (!reply.hasHeader('Permissions-Policy')) {
      reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    }

    if (!reply.hasHeader('Strict-Transport-Security')) {
      reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    return payload;
  });

  await app.register(authRoutes, {
    pool,
    joinGlobal,
    toUserPayload,
    rateLimiter
  });

  await app.register(userRoutes, {
    pool,
    getUser,
    toUserPayload,
    broadcastUserUpdate,
    rateLimiter
  });

  await app.register(threadRoutes, {
    pool,
    canAccessThread,
    getUser,
    listThreads,
    getThreadRow,
    getThreadById,
    leaveThread,
    getOrCreateDmThread,
    hydrateMessage,
    formatMessage,
    broadcastThreadUpdate,
    rateLimiter
  });

  app.get('/api/health', async () => ({ ok: true }));

  return app;
}

function createCorsOrigin(clientOrigin) {
  const allowedOrigins = new Set(
    String(clientOrigin || '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
  );

  return (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    callback(null, allowedOrigins.has(origin));
  };
}
