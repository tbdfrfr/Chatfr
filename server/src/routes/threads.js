import crypto from 'crypto';
import { normalizeDisplayName } from '../auth.js';
import {
  MAX_GROUP_MEMBER_COUNT,
  normalizeGroupNameColor,
  normalizeGroupNameFont
} from '../chatFormatting.js';
import { threadRouteSchemas } from '../validationSchemas.js';

export async function threadRoutes(app, options) {
  const {
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
  } = options;

  app.get('/api/threads', { preHandler: app.authenticate }, async (request) => {
    return { threads: await listThreads(request.userId) };
  });

  app.post('/api/dm/start', { preHandler: [app.authenticate, app.requireCsrf], schema: threadRouteSchemas.dmStart }, async (request, reply) => {
    const targetUserId = Number(request.body?.userNumber);

    if (!Number.isInteger(targetUserId)) {
      return reply.code(400).send({ error: 'Invalid user number.' });
    }

    if (targetUserId === request.userId) {
      return reply.code(400).send({ error: 'You cannot DM yourself.' });
    }

    const targetUser = await getUser(targetUserId);
    if (!targetUser) {
      return reply.code(404).send({ error: 'User not found.' });
    }

    const thread = await getOrCreateDmThread(request.userId, targetUserId);
    return reply.send({ thread });
  });

  app.post('/api/groups', { preHandler: [app.authenticate, app.requireCsrf], schema: threadRouteSchemas.createGroup }, async (request, reply) => {
    const name = normalizeDisplayName(request.body?.name);
    const nameColor = normalizeGroupNameColor(request.body?.nameColor);
    const nameFont = normalizeGroupNameFont(request.body?.nameFont);
    const memberNumbers = Array.isArray(request.body?.memberNumbers) ? request.body.memberNumbers : [];
    const memberIds = new Set([request.userId]);

    for (const value of memberNumbers) {
      const userId = Number(value);

      if (!Number.isInteger(userId) || userId === request.userId) {
        continue;
      }

      const member = await getUser(userId);
      if (member) {
        memberIds.add(userId);
      }
    }

    if (memberIds.size > MAX_GROUP_MEMBER_COUNT) {
      return reply.code(400).send({ error: `Groups can have up to ${MAX_GROUP_MEMBER_COUNT} users.` });
    }

    const threadId = `group_${crypto.randomUUID()}`;
    await pool.query(
      'INSERT INTO threads (id, type, name, name_color, name_font, created_by) VALUES ($1, $2, $3, $4, $5, $6)',
      [threadId, 'group', name, nameColor, nameFont, request.userId]
    );

    for (const userId of memberIds) {
      await pool.query('INSERT INTO thread_members (thread_id, user_id) VALUES ($1, $2)', [threadId, userId]);
    }

    const thread = await getThreadById(threadId, request.userId);
    return reply.send({ thread });
  });

  app.patch('/api/groups/:threadId', { preHandler: [app.authenticate, app.requireCsrf], schema: threadRouteSchemas.updateGroup }, async (request, reply) => {
    const threadId = String(request.params.threadId);
    const name = normalizeDisplayName(request.body?.name);
    const nameColor = normalizeGroupNameColor(request.body?.nameColor);
    const nameFont = normalizeGroupNameFont(request.body?.nameFont);
    const memberNumbers = Array.isArray(request.body?.memberNumbers) ? request.body.memberNumbers : [];

    const thread = await getThreadRow(threadId);
    if (!thread || thread.type !== 'group') {
      return reply.code(404).send({ error: 'Group not found.' });
    }

    if (Number(thread.created_by) !== Number(request.userId)) {
      return reply.code(403).send({ error: 'Only the group creator can edit this group.' });
    }

    const memberIds = new Set([request.userId]);

    for (const value of memberNumbers) {
      const userId = Number(value);

      if (!Number.isInteger(userId) || userId === request.userId) {
        continue;
      }

      const member = await getUser(userId);
      if (member) {
        memberIds.add(userId);
      }
    }

    if (memberIds.size > MAX_GROUP_MEMBER_COUNT) {
      return reply.code(400).send({ error: `Groups can have up to ${MAX_GROUP_MEMBER_COUNT} users.` });
    }

    await pool.query('UPDATE threads SET name = $1, name_color = $2, name_font = $3 WHERE id = $4', [name, nameColor, nameFont, threadId]);
    await pool.query('DELETE FROM thread_members WHERE thread_id = $1', [threadId]);

    for (const userId of memberIds) {
      await pool.query('INSERT INTO thread_members (thread_id, user_id) VALUES ($1, $2)', [threadId, userId]);
    }

    return reply.send({ thread: await getThreadById(threadId, request.userId) });
  });

  app.delete('/api/groups/:threadId', { preHandler: [app.authenticate, app.requireCsrf], schema: threadRouteSchemas.threadId }, async (request, reply) => {
    const threadId = String(request.params.threadId);

    const thread = await getThreadRow(threadId);
    if (!thread || thread.type !== 'group') {
      return reply.code(404).send({ error: 'Group not found.' });
    }

    if (Number(thread.created_by) !== Number(request.userId)) {
      return reply.code(403).send({ error: 'Only the group creator can delete this group.' });
    }

    await pool.query('DELETE FROM threads WHERE id = $1', [threadId]);
    return { ok: true, deleted: true };
  });

  app.post('/api/threads/:threadId/leave', { preHandler: [app.authenticate, app.requireCsrf], schema: threadRouteSchemas.threadId }, async (request, reply) => {
    const threadId = String(request.params.threadId);

    if (threadId === 'global') {
      return reply.code(400).send({ error: 'You cannot leave global.' });
    }

    if (!(await canAccessThread(threadId, request.userId))) {
      return reply.code(404).send({ error: 'Thread not found.' });
    }

    await leaveThread(threadId, request.userId);
    return { ok: true, deleted: true };
  });

  app.get('/api/threads/:threadId/messages', { preHandler: app.authenticate, schema: threadRouteSchemas.messages }, async (request, reply) => {
    const threadId = String(request.params.threadId);
    const before = request.query.before ? Number(request.query.before) : null;
    const limit = Math.min(Math.max(Number(request.query.limit || 50), 1), 100);

    if (!(await canAccessThread(threadId, request.userId))) {
      return reply.code(404).send({ error: 'Thread not found.' });
    }

    const { sql, params } = before
      ? {
          sql: `
            SELECT m.*, u.display_name, u.profile_picture
            FROM messages m
            JOIN users u ON u.id = m.user_id
            WHERE m.thread_id = $1 AND m.id < $2
            ORDER BY m.id DESC
            LIMIT $3
          `,
          params: [threadId, before, limit]
        }
      : {
          sql: `
            SELECT m.*, u.display_name, u.profile_picture
            FROM messages m
            JOIN users u ON u.id = m.user_id
            WHERE m.thread_id = $1
            ORDER BY m.id DESC
            LIMIT $2
          `,
          params: [threadId, limit]
        };

    const result = await pool.query(sql, params);
    return {
      messages: result.rows.reverse().map(formatMessage),
      hasMore: result.rowCount === limit
    };
  });

  app.post('/api/threads/:threadId/messages', { preHandler: [app.authenticate, app.requireCsrf], schema: threadRouteSchemas.createMessage }, async (request, reply) => {
    const threadId = String(request.params.threadId);
    const content = typeof request.body?.content === 'string' ? request.body.content.trim() : '';

    if (!content || content.length > 2000) {
      return reply.code(400).send({ error: 'Message must be 1 to 2000 characters.' });
    }

    if (!(await canAccessThread(threadId, request.userId))) {
      return reply.code(404).send({ error: 'Thread not found.' });
    }

    if (!(await rateLimiter.allowMessage(request.userId))) {
      return reply.code(429).send({ error: 'Rate limit exceeded. Try again shortly.' });
    }

    const result = await pool.query(
      `INSERT INTO messages (thread_id, user_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, thread_id, user_id, content, created_at`,
      [threadId, request.userId, content]
    );

    await pool.query('UPDATE threads SET last_message_at = NOW() WHERE id = $1', [threadId]);

    const message = await hydrateMessage(result.rows[0].id);
    broadcastThreadUpdate(threadId, message);

    return reply.send({ message });
  });
}
