import Fastify from 'fastify';
import cors from '@fastify/cors';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { readFile } from 'node:fs/promises';
import { WebSocketServer, WebSocket } from 'ws';
import { createPool } from './db.js';
import { allowMessage } from './rateLimit.js';
import { ensureSchema } from './schema.js';
import {
  assertEnv,
  hashPassword,
  normalizeDisplayName,
  signToken,
  verifyPassword,
  verifyToken
} from './auth.js';

dotenv.config();
assertEnv();

const PROFILE_PICTURE_GRID_SIZE = 7;
const PROFILE_PICTURE_CELL_COUNT = PROFILE_PICTURE_GRID_SIZE * PROFILE_PICTURE_GRID_SIZE;
const MAX_GROUP_MEMBER_COUNT = 100;
const GROUP_NAME_FONT_OPTIONS = new Set(['space-grotesk', 'nunito', 'pacifico', 'playfair', 'bebas-neue', 'oswald', 'raleway', 'merriweather', 'cinzel', 'rubik', 'outfit', 'manrope', 'comfortaa', 'caveat', 'lobster', 'anton', 'fira-code', 'ibm-plex-serif', 'josefin-sans', 'orbitron']);
const GROUP_NAME_COLOR_OPTIONS = new Set(['#e63946', '#ff6b6b', '#f97316', '#ff9f1c', '#ffd166', '#f1fa8c', '#a3e635', '#06d6a0', '#2ec4b6', '#14b8a6', '#118ab2', '#3a86ff', '#073b4c', '#8b5cf6', '#8338ec', '#c77dff', '#b5179e', '#ff4fa3', '#ef476f', '#eeeeee']);
const DEFAULT_GROUP_NAME_FONT = 'space-grotesk';
const DEFAULT_GROUP_NAME_COLOR = '#eeeeee';
const TBD_ACCOUNT_ID = 1;
const TBD_ACCOUNT_NAME = 'tbd';
const TBD_ACCOUNT_IMAGE_URL = new URL('../../IMG_1687.JPG', import.meta.url);

const app = Fastify({ logger: true });
const pool = createPool();
const clients = new Map();

await ensureSchema(pool);
await seedTbdAccountProfilePicture();

await app.register(cors, {
  origin: process.env.CLIENT_ORIGIN || true,
  credentials: true
});

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

app.get('/api/health', async () => ({ ok: true }));

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
    profilePicture = normalizeProfilePictureInput(request.body?.profilePicture);
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

app.get('/api/threads', { preHandler: app.authenticate }, async (request) => {
  return { threads: await listThreads(request.userId) };
});

app.post('/api/dm/start', { preHandler: app.authenticate }, async (request, reply) => {
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

app.post('/api/groups', { preHandler: app.authenticate }, async (request, reply) => {
  const name = normalizeDisplayName(request.body?.name);
  const nameColor = normalizeGroupNameColor(request.body?.nameColor);
  const nameFont = normalizeGroupNameFont(request.body?.nameFont);
  const memberNumbers = Array.isArray(request.body?.memberNumbers) ? request.body.memberNumbers : [];
  const memberIds = new Set([request.userId]);

  for (const value of memberNumbers) {
    const userId = Number(value);

    if (!Number.isInteger(userId)) {
      continue;
    }

    if (userId === request.userId) {
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

app.patch('/api/groups/:threadId', { preHandler: app.authenticate }, async (request, reply) => {
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

app.delete('/api/groups/:threadId', { preHandler: app.authenticate }, async (request, reply) => {
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

app.post('/api/groups/:threadId/members', { preHandler: app.authenticate }, async (request, reply) => {
  const threadId = String(request.params.threadId);
  const memberNumbers = Array.isArray(request.body?.memberNumbers) ? request.body.memberNumbers : [];

  const thread = await getThreadById(threadId, request.userId);
  if (!thread || thread.type !== 'group') {
    return reply.code(404).send({ error: 'Group not found.' });
  }

  const currentMembers = await pool.query('SELECT user_id FROM thread_members WHERE thread_id = $1', [threadId]);
  const memberIds = new Set(currentMembers.rows.map((row) => Number(row.user_id)));

  for (const value of memberNumbers) {
    const userId = Number(value);
    if (!Number.isInteger(userId)) {
      continue;
    }

    if (userId === request.userId) {
      continue;
    }

    const user = await getUser(userId);
    if (user && !memberIds.has(userId)) {
      if (memberIds.size >= MAX_GROUP_MEMBER_COUNT) {
        return reply.code(400).send({ error: `Groups can have up to ${MAX_GROUP_MEMBER_COUNT} users.` });
      }

      await pool.query('INSERT INTO thread_members (thread_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [threadId, userId]);
      memberIds.add(userId);
    }
  }

  return { thread: await getThreadById(threadId, request.userId) };
});

app.post('/api/threads/:threadId/leave', { preHandler: app.authenticate }, async (request, reply) => {
  const threadId = String(request.params.threadId);

  if (threadId === 'global') {
    return reply.code(400).send({ error: 'You cannot leave global.' });
  }

  await leaveThread(threadId, request.userId);
  return { ok: true, deleted: true };
});

app.post('/api/groups/:threadId/leave', { preHandler: app.authenticate }, async (request, reply) => {
  const threadId = String(request.params.threadId);

  const thread = await getThreadRow(threadId);
  if (!thread || thread.type !== 'group') {
    return reply.code(404).send({ error: 'Group not found.' });
  }

  await leaveThread(threadId, request.userId);
  return { ok: true, deleted: true };
});

app.get('/api/threads/:threadId/messages', { preHandler: app.authenticate }, async (request, reply) => {
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

app.post('/api/threads/:threadId/messages', { preHandler: app.authenticate }, async (request, reply) => {
  const threadId = String(request.params.threadId);
  const content = typeof request.body?.content === 'string' ? request.body.content.trim() : '';

  if (!content || content.length > 2000) {
    return reply.code(400).send({ error: 'Message must be 1 to 2000 characters.' });
  }

  if (!(await canAccessThread(threadId, request.userId))) {
    return reply.code(404).send({ error: 'Thread not found.' });
  }

  if (!allowMessage(request.userId)) {
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

const server = app.server;
const sockets = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url, 'http://localhost');

  if (url.pathname !== '/ws') {
    socket.destroy();
    return;
  }

  sockets.handleUpgrade(request, socket, head, (websocket) => {
    sockets.emit('connection', websocket, request);
  });
});

sockets.on('connection', (socket, request) => {
  const url = new URL(request.url, 'http://localhost');
  const token = url.searchParams.get('token');

  if (!token) {
    socket.close();
    return;
  }

  let userId;

  try {
    userId = verifyToken(token);
  } catch {
    socket.close();
    return;
  }

  clients.set(socket, userId);

  socket.on('message', (raw) => {
    try {
      const payload = JSON.parse(raw.toString());

      if (payload.type === 'ping') {
        socket.send(JSON.stringify({ type: 'pong' }));
      }
    } catch {
      socket.send(JSON.stringify({ type: 'error', error: 'Invalid payload' }));
    }
  });

  socket.on('close', () => {
    clients.delete(socket);
  });
});

const port = Number(process.env.PORT || 3001);
await app.listen({ port, host: '0.0.0.0' });

async function canAccessThread(threadId, userId) {
  if (threadId === 'global') {
    return true;
  }

  const result = await pool.query('SELECT 1 FROM thread_members WHERE thread_id = $1 AND user_id = $2', [threadId, userId]);
  return result.rowCount > 0;
}

async function joinGlobal(userId) {
  await pool.query("INSERT INTO thread_members (thread_id, user_id) VALUES ('global', $1) ON CONFLICT DO NOTHING", [userId]);
}

async function getUser(userId) {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
  return result.rows[0] || null;
}

async function listThreads(userId) {
  const result = await pool.query(
    `WITH visible_threads AS (
       SELECT t.*
       FROM threads t
       WHERE t.type = 'global'
       UNION
       SELECT t.*
       FROM threads t
       JOIN thread_members tm ON tm.thread_id = t.id
       WHERE tm.user_id = $1 AND t.type IN ('dm', 'group')
     )
     SELECT vt.*, m.content AS last_message_content, m.created_at AS last_message_created_at, m.user_id AS last_message_user_id
     FROM visible_threads vt
     LEFT JOIN LATERAL (
       SELECT *
       FROM messages
       WHERE thread_id = vt.id
       ORDER BY id DESC
       LIMIT 1
     ) m ON true
     ORDER BY COALESCE(m.created_at, vt.last_message_at) DESC`,
    [userId]
  );

  const threads = [];

  for (const thread of result.rows) {
    threads.push(await getThreadSummary(thread, userId));
  }

  return threads;
}

async function getThreadSummary(thread, userId) {
  if (thread.type === 'global') {
    return {
      id: thread.id,
      type: thread.type,
      name: thread.name,
      members: [],
      lastMessage: thread.last_message_content
        ? {
            content: thread.last_message_content,
            createdAt: thread.last_message_created_at,
            userId: thread.last_message_user_id
          }
        : null
    };
  }

  const members = await pool.query(
    `SELECT u.id, u.display_name, u.profile_picture
     FROM thread_members tm
     JOIN users u ON u.id = tm.user_id
     WHERE tm.thread_id = $1
     ORDER BY u.id ASC`,
    [thread.id]
  );

  return {
    id: thread.id,
    type: thread.type,
    name: thread.name,
    nameColor: normalizeGroupNameColor(thread.name_color),
    nameFont: normalizeGroupNameFont(thread.name_font),
    createdBy: thread.created_by ? Number(thread.created_by) : null,
    members: members.rows.map(toUserPayload),
    lastMessage: thread.last_message_content
      ? {
          content: thread.last_message_content,
          createdAt: thread.last_message_created_at,
          userId: thread.last_message_user_id
        }
      : null,
    directLabel: thread.type === 'dm' ? getDirectLabel(members.rows, userId) : null
  };
}

async function getThreadById(threadId, userId) {
  const result = await pool.query('SELECT * FROM threads WHERE id = $1', [threadId]);
  const thread = result.rows[0];

  if (!thread) {
    return null;
  }

  if (thread.type !== 'global') {
    const access = await canAccessThread(threadId, userId);
    if (!access) {
      return null;
    }
  }

  return getThreadSummary(thread, userId);
}

async function leaveThread(threadId, userId) {
  const thread = await getThreadRow(threadId);

  if (!thread) {
    return { deleted: true };
  }

  if (thread.type === 'dm') {
    await pool.query('DELETE FROM threads WHERE id = $1', [threadId]);
    return { deleted: true };
  }

  await pool.query('DELETE FROM thread_members WHERE thread_id = $1 AND user_id = $2', [threadId, userId]);

  const remaining = await pool.query('SELECT COUNT(*)::int AS count FROM thread_members WHERE thread_id = $1', [threadId]);
  if (remaining.rows[0].count === 0) {
    await pool.query('DELETE FROM threads WHERE id = $1', [threadId]);
    return { deleted: true };
  }

  return { deleted: true };
}

async function getThreadRow(threadId) {
  const result = await pool.query('SELECT * FROM threads WHERE id = $1', [threadId]);
  return result.rows[0] || null;
}

async function getOrCreateDmThread(userId, otherUserId) {
  const key = [userId, otherUserId].sort((a, b) => a - b).join(':');
  const threadId = `dm_${key}`;

  await pool.query(
    `INSERT INTO threads (id, type, name, created_by, dm_key)
     VALUES ($1, 'dm', NULL, $2, $3)
     ON CONFLICT (dm_key) DO NOTHING`,
    [threadId, userId, key]
  );

  const thread = await pool.query('SELECT * FROM threads WHERE dm_key = $1', [key]);
  const id = thread.rows[0].id;

  await pool.query('INSERT INTO thread_members (thread_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, userId]);
  await pool.query('INSERT INTO thread_members (thread_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, otherUserId]);

  return await getThreadById(id, userId);
}

async function hydrateMessage(messageId) {
  const result = await pool.query(
    `SELECT m.*, u.display_name, u.profile_picture
     FROM messages m
     JOIN users u ON u.id = m.user_id
     WHERE m.id = $1`,
    [messageId]
  );

  return formatMessage(result.rows[0]);
}

function formatMessage(message) {
  return {
    id: Number(message.id),
    threadId: message.thread_id,
    user: toUserPayload({ id: message.user_id, display_name: message.display_name, profile_picture: message.profile_picture }),
    content: message.content,
    createdAt: message.created_at
  };
}

function broadcastThreadUpdate(threadId, message) {
  const payload = JSON.stringify({ type: 'message:new', threadId, message });

  for (const [socket, userId] of clients.entries()) {
    if (socket.readyState !== WebSocket.OPEN) {
      continue;
    }

    canAccessThread(threadId, userId).then((allowed) => {
      if (allowed) {
        socket.send(payload);
      }
    });
  }
}

function broadcastUserUpdate(userRow) {
  const user = toUserPayload(userRow);
  const payload = JSON.stringify({ type: 'user:updated', user });

  for (const [socket] of clients.entries()) {
    if (socket.readyState !== WebSocket.OPEN) {
      continue;
    }

    socket.send(payload);
  }
}

function toUserPayload(user) {
  if (!user) {
    return null;
  }

  const userNumber = user.user_id ?? user.id;

  return {
    id: Number(userNumber),
    displayName: user.display_name,
    profilePicture: normalizeStoredProfilePicture(user.profile_picture),
    label: user.display_name || `#${userNumber}`
  };
}

function normalizeProfilePictureInput(value) {
  if (isImageProfilePicture(value)) {
    return value.trim();
  }

  if (!Array.isArray(value) || value.length !== PROFILE_PICTURE_CELL_COUNT) {
    throw new Error(`Profile picture must be a ${PROFILE_PICTURE_GRID_SIZE}x${PROFILE_PICTURE_GRID_SIZE} grid.`);
  }

  return value.map((cell) => {
    if (cell === null || cell === '') {
      return null;
    }

    if (typeof cell !== 'string') {
      throw new Error('Profile picture cells must be a hex color or blank.');
    }

    const color = cell.trim().toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(color)) {
      throw new Error('Profile picture colors must use 6-digit hex format like #1a2b3c.');
    }

    return color;
  });
}

function normalizeStoredProfilePicture(value) {
  if (isImageProfilePicture(value)) {
    return value.trim();
  }

  if (!Array.isArray(value) || value.length !== PROFILE_PICTURE_CELL_COUNT) {
    return null;
  }

  return value.map((cell) => {
    if (typeof cell !== 'string') {
      return null;
    }

    const color = cell.trim().toLowerCase();
    return /^#[0-9a-f]{6}$/.test(color) ? color : null;
  });
}

function normalizeGroupNameColor(value) {
  if (typeof value !== 'string') {
    return DEFAULT_GROUP_NAME_COLOR;
  }

  const color = value.trim().toLowerCase();
  return GROUP_NAME_COLOR_OPTIONS.has(color) ? color : DEFAULT_GROUP_NAME_COLOR;
}

function normalizeGroupNameFont(value) {
  if (typeof value !== 'string') {
    return DEFAULT_GROUP_NAME_FONT;
  }

  const font = value.trim().toLowerCase();
  return GROUP_NAME_FONT_OPTIONS.has(font) ? font : DEFAULT_GROUP_NAME_FONT;
}

async function seedTbdAccountProfilePicture() {
  const result = await pool.query('SELECT id, display_name, profile_picture FROM users WHERE id = $1', [TBD_ACCOUNT_ID]);
  const user = result.rows[0];

  if (!user || user.display_name !== TBD_ACCOUNT_NAME) {
    return;
  }

  const imageBuffer = await readFile(TBD_ACCOUNT_IMAGE_URL);
  const imageDataUrl = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;

  if (user.profile_picture === imageDataUrl) {
    return;
  }

  await pool.query('UPDATE users SET profile_picture = $1::jsonb WHERE id = $2', [JSON.stringify(imageDataUrl), TBD_ACCOUNT_ID]);
}

function isImageProfilePicture(value) {
  return typeof value === 'string' && /^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+$/i.test(value.trim());
}

function getDirectLabel(members, userId) {
  const other = members.find((member) => Number(member.id) !== Number(userId));
  return other ? (other.display_name || `#${other.id}`) : 'Direct message';
}
