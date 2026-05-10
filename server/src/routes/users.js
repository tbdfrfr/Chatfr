import { normalizeDisplayName } from '../auth.js';
import { TBD_ACCOUNT_ID, normalizeProfilePictureInput } from '../chatFormatting.js';

export async function userRoutes(app, options) {
  const { pool, getUser, toUserPayload, broadcastUserUpdate } = options;

  app.get('/api/me', { preHandler: app.authenticate }, async (request) => {
    const user = await getUser(request.userId);
    return { user: toUserPayload(user) };
  });

  app.patch('/api/me/display-name', { preHandler: app.authenticate }, async (request, reply) => {
    const displayName = normalizeDisplayName(request.body?.displayName);

    await pool.query('UPDATE users SET display_name = $1 WHERE id = $2', [displayName, request.userId]);
    const user = await getUser(request.userId);
    broadcastUserUpdate(user);
    return reply.send({ user: toUserPayload(user) });
  });

  app.patch('/api/me/profile-picture', { preHandler: app.authenticate }, async (request, reply) => {
    let profilePicture;

    try {
      profilePicture = normalizeProfilePictureInput(request.body?.profilePicture, {
        allowImage: Number(request.userId) === TBD_ACCOUNT_ID
      });
    } catch (error) {
      return reply.code(400).send({ error: error.message });
    }

    await pool.query('UPDATE users SET profile_picture = $1::jsonb WHERE id = $2', [JSON.stringify(profilePicture), request.userId]);
    const user = await getUser(request.userId);
    broadcastUserUpdate(user);
    return reply.send({ user: toUserPayload(user) });
  });

  app.get('/api/users/search', { preHandler: app.authenticate }, async (request) => {
    const query = String(request.query?.query ?? '').trim();

    if (!query) {
      return { users: [] };
    }

    const result = await pool.query(
      `SELECT id, display_name, profile_picture
       FROM users
       WHERE (id::text LIKE $1 OR COALESCE(display_name, '') ILIKE $2)
         AND id <> $3
       ORDER BY id ASC
       LIMIT 8`,
      [`${query}%`, `%${query}%`, request.userId]
    );

    return { users: result.rows.map(toUserPayload) };
  });

  app.get('/api/users/:userNumber', { preHandler: app.authenticate }, async (request, reply) => {
    const userId = Number(request.params.userNumber);

    if (!Number.isInteger(userId)) {
      return reply.code(400).send({ error: 'Invalid user number.' });
    }

    const user = await getUser(userId);

    if (!user) {
      return reply.code(404).send({ error: 'User not found.' });
    }

    return { user: toUserPayload(user) };
  });
}
