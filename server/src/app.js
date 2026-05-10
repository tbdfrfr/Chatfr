import Fastify from 'fastify';
import cors from '@fastify/cors';
import { authRoutes } from './routes/auth.js';
import { userRoutes } from './routes/users.js';
import { threadRoutes } from './routes/threads.js';

export async function createApp({ pool, domainServices, toUserPayload, verifyToken, clientOrigin }) {
  const app = Fastify({ logger: true });
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
    const header = request.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      request.userId = verifyToken(header.slice(7));
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  await app.register(authRoutes, {
    pool,
    joinGlobal,
    toUserPayload
  });

  await app.register(userRoutes, {
    pool,
    getUser,
    toUserPayload,
    broadcastUserUpdate
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
    broadcastThreadUpdate
  });

  await app.register(cors, {
    origin: clientOrigin || true,
    credentials: true
  });

  app.addHook('onSend', async (_request, reply, payload) => {
    if (!reply.hasHeader('X-Content-Type-Options')) {
      reply.header('X-Content-Type-Options', 'nosniff');
    }

    if (!reply.hasHeader('Content-Security-Policy')) {
      reply.header('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' ws: wss:");
    }

    if (!reply.hasHeader('Strict-Transport-Security')) {
      reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    return payload;
  });

  app.get('/api/health', async () => ({ ok: true }));

  return app;
}