import {
  clearSessionCookie,
  hashPassword,
  normalizeDisplayName,
  signCsrfToken,
  signToken,
  setSessionCookie,
  verifyPassword
} from '../auth.js';
import { authRouteSchemas } from '../validationSchemas.js';

export async function authRoutes(app, options) {
  const { pool, joinGlobal, toUserPayload, rateLimiter } = options;

  app.get('/api/csrf', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store');
    return { csrfToken: signCsrfToken() };
  });

  app.post('/api/auth/signup', { preHandler: app.requireCsrf, schema: authRouteSchemas.signup }, async (request, reply) => {
    const { password, displayName } = request.body || {};

    if (!(await rateLimiter.allowSignupAttempt(request.ip))) {
      return reply.code(429).send({ error: 'Too many signup attempts. Try again later.' });
    }

    const passwordHash = await hashPassword(password);
    const name = normalizeDisplayName(displayName);

    const result = await pool.query(
      `INSERT INTO users (display_name, password_hash)
       VALUES ($1, $2)
       RETURNING id, display_name, profile_picture, session_version, created_at`,
      [name, passwordHash]
    );

    const user = result.rows[0];
    await joinGlobal(user.id);
    const token = signToken(user.id, user.session_version);
    setSessionCookie(reply, token);

    return reply.send({
      user: toUserPayload(user)
    });
  });

  app.post('/api/auth/login', { preHandler: app.requireCsrf, schema: authRouteSchemas.login }, async (request, reply) => {
    const { userNumber, password } = request.body || {};
    const userId = Number(userNumber);

    if (!(await rateLimiter.allowLoginAttempt({ userId: Number.isInteger(userId) ? userId : 'unknown', ip: request.ip }))) {
      return reply.code(429).send({ error: 'Too many login attempts. Try again later.' });
    }

    if (!Number.isInteger(userId)) {
      return reply.code(400).send({ error: 'Invalid credentials.' });
    }

    const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    const user = result.rows[0];

    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return reply.code(401).send({ error: 'Invalid credentials.' });
    }

    const token = signToken(user.id, user.session_version);
    setSessionCookie(reply, token);

    return reply.send({
      user: toUserPayload(user)
    });
  });

  app.post('/api/auth/logout', { preHandler: [app.authenticate, app.requireCsrf] }, async (request, reply) => {
    await pool.query('UPDATE users SET session_version = session_version + 1 WHERE id = $1', [request.userId]);
    clearSessionCookie(reply);
    return reply.send({ ok: true });
  });
}
