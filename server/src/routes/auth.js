import { allowLoginAttempt } from '../rateLimit.js';
import {
  hashPassword,
  normalizeDisplayName,
  signToken,
  verifyPassword
} from '../auth.js';

export async function authRoutes(app, options) {
  const { pool, joinGlobal, toUserPayload } = options;

  app.post('/api/auth/signup', async (request, reply) => {
    const { password, displayName } = request.body || {};

    if (typeof password !== 'string' || password.length < 8) {
      return reply.code(400).send({ error: 'Password must be at least 8 characters long.' });
    }

    const passwordHash = await hashPassword(password);
    const name = normalizeDisplayName(displayName);

    const result = await pool.query(
      `INSERT INTO users (display_name, password_hash)
       VALUES ($1, $2)
       RETURNING id, display_name, profile_picture, created_at`,
      [name, passwordHash]
    );

    const user = result.rows[0];
    await joinGlobal(user.id);

    return reply.send({
      token: signToken(user.id),
      user: toUserPayload(user)
    });
  });

  app.post('/api/auth/login', async (request, reply) => {
    const { userNumber, password } = request.body || {};
    const userId = Number(userNumber);

    if (!allowLoginAttempt({ userId: Number.isInteger(userId) ? userId : 'unknown', ip: request.ip })) {
      return reply.code(429).send({ error: 'Too many login attempts. Try again later.' });
    }

    if (!Number.isInteger(userId) || typeof password !== 'string') {
      return reply.code(400).send({ error: 'Invalid credentials.' });
    }

    const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    const user = result.rows[0];

    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return reply.code(401).send({ error: 'Invalid credentials.' });
    }

    return reply.send({
      token: signToken(user.id),
      user: toUserPayload(user)
    });
  });
}
