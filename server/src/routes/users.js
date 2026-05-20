import { normalizeDisplayName } from '../auth.js';
import { TBD_ACCOUNT_ID, normalizeProfilePictureInput } from '../chatFormatting.js';
import { userRouteSchemas } from '../validationSchemas.js';

export async function userRoutes(app, options) {
  const { pool, getUser, toUserPayload, broadcastUserUpdate, rateLimiter } = options;

  app.get('/api/me', { preHandler: app.authenticate }, async (request) => {
    const user = await getUser(request.userId);
    return { user: toUserPayload(user) };
  });

  app.patch('/api/me/display-name', { preHandler: [app.authenticate, app.requireCsrf], schema: userRouteSchemas.displayName }, async (request, reply) => {
    const displayName = normalizeDisplayName(request.body?.displayName);

    await pool.query('UPDATE users SET display_name = $1 WHERE id = $2', [displayName, request.userId]);
    const user = await getUser(request.userId);
    broadcastUserUpdate(user);
    return reply.send({ user: toUserPayload(user) });
  });

  app.patch('/api/me/profile-picture', { preHandler: [app.authenticate, app.requireCsrf], schema: userRouteSchemas.profilePicture }, async (request, reply) => {
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

  app.get('/api/users/:userNumber', { preHandler: app.authenticate, schema: userRouteSchemas.userNumber }, async (request, reply) => {
    const userId = Number(request.params.userNumber);

    if (!(await rateLimiter.allowUserLookup({ userId: request.userId, ip: request.ip }))) {
      return reply.code(429).send({ error: 'Too many user lookups. Try again later.' });
    }

    const user = await getUser(userId);

    if (!user) {
      return reply.code(404).send({ error: 'User not found.' });
    }

    return { user: toUserPayload(user) };
  });
}
