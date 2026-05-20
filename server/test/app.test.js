import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/app.js';
import { hashPassword, verifyToken as verifyJwtToken } from '../src/auth.js';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

function createDomainServices(overrides = {}) {
  const user = { id: 1, display_name: 'Test User', profile_picture: null, session_version: 0 };

  return {
    canAccessThread: async () => true,
    joinGlobal: async () => {},
    getUser: async (id) => (Number(id) === 1 ? user : null),
    listThreads: async () => [],
    getThreadById: async (id) => ({ id, type: 'group', members: [] }),
    leaveThread: async () => ({ deleted: true }),
    getThreadRow: async (id) => ({ id, type: 'group', created_by: 1 }),
    getOrCreateDmThread: async () => ({ id: 'dm_1:2', type: 'dm', members: [] }),
    hydrateMessage: async (id) => ({
      id,
      threadId: 'global',
      user: { id: 1, displayName: 'Test User', profilePicture: null },
      content: 'hello',
      createdAt: new Date().toISOString()
    }),
    formatMessage: (message) => message,
    broadcastThreadUpdate: () => {},
    broadcastUserUpdate: () => {},
    ...overrides
  };
}

function toUserPayload(user) {
  if (!user) {
    return null;
  }

  const id = user.user_id ?? user.id;
  return {
    id: Number(id),
    displayName: user.display_name,
    profilePicture: null,
    label: user.display_name || `#${id}`
  };
}

async function createTestApp({ pool = createPool(), domainServices, verifyToken } = {}) {
  const defaultDomainServices = createDomainServices({
    getUser: async (id) => (Number(id) === 1 ? pool.currentUser : null)
  });

  const app = await createApp({
    pool,
    domainServices: domainServices || defaultDomainServices,
    toUserPayload,
    verifyToken: verifyToken || ((token) => {
      if (token === 'good-token') {
        return 1;
      }

      return verifyJwtToken(token);
    }),
    clientOrigin: 'http://localhost:5173',
    logger: false
  });

  return app;
}

async function getCsrfToken(app) {
  const response = await app.inject({ method: 'GET', url: '/api/csrf' });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['cache-control'], 'no-store');
  return response.json().csrfToken;
}

function createPool({ insertedUser, loginUser } = {}) {
  const user = insertedUser || { id: 1, display_name: 'New User', profile_picture: null, session_version: 0, created_at: new Date() };
  const currentUser = loginUser || user;

  return {
    currentUser,
    queries: [],
    async query(sql, params = []) {
      this.queries.push({ sql, params });

      if (sql.includes('INSERT INTO users')) {
        this.currentUser = { ...user };
        return { rows: [user], rowCount: 1 };
      }

      if (sql.includes('SELECT * FROM users WHERE id = $1')) {
        return { rows: this.currentUser ? [this.currentUser] : [], rowCount: this.currentUser ? 1 : 0 };
      }

      if (sql.includes('UPDATE users SET session_version = session_version + 1 WHERE id = $1')) {
        if (this.currentUser && Number(params[0]) === Number(this.currentUser.id)) {
          this.currentUser = { ...this.currentUser, session_version: Number(this.currentUser.session_version || 0) + 1 };
        }

        return { rows: [], rowCount: 1 };
      }

      if (sql.includes('INSERT INTO messages')) {
        return { rows: [{ id: 12, thread_id: params[0], user_id: params[1], content: params[2], created_at: new Date() }], rowCount: 1 };
      }

      return { rows: [], rowCount: 0 };
    }
  };
}

test('health route returns security headers', async () => {
  const app = await createTestApp();
  const response = await app.inject({ method: 'GET', url: '/api/health' });

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.match(response.headers['content-security-policy'], /script-src 'self'/);
  assert.doesNotMatch(response.headers['content-security-policy'], /challenges\.cloudflare\.com/);
  assert.equal(response.headers['x-frame-options'], 'DENY');
  assert.equal(response.headers['referrer-policy'], 'no-referrer');
  await app.close();
});

test('protected routes reject missing and bad tokens', async () => {
  const app = await createTestApp();

  const missing = await app.inject({ method: 'GET', url: '/api/me' });
  assert.equal(missing.statusCode, 401);

  const invalid = await app.inject({
    method: 'GET',
    url: '/api/me',
    headers: { authorization: 'Bearer nope' }
  });
  assert.equal(invalid.statusCode, 401);

  await app.close();
});

test('signup validates request body before creating a user', async () => {
  const pool = createPool();
  const app = await createTestApp({ pool });
  const csrfToken = await getCsrfToken(app);

  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    headers: { 'x-csrf-token': csrfToken },
    payload: { displayName: 'Test', password: 'short' }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(pool.queries.length, 0);
  await app.close();
});

test('signup creates a user when validation passes', async () => {
  let joinedUserId = null;
  const app = await createTestApp({
    domainServices: createDomainServices({
      joinGlobal: async (id) => {
        joinedUserId = Number(id);
      }
    })
  });
  const csrfToken = await getCsrfToken(app);

  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    headers: { 'x-csrf-token': csrfToken },
    payload: { displayName: 'Test', password: 'long-enough-password' }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().user.id, 1);
  assert.equal(response.json().token, undefined);
  assert.match(getSetCookie(response), /chatfr\.session=.*HttpOnly/);
  assert.equal(joinedUserId, 1);
  await app.close();
});

test('login validates credentials', async () => {
  const passwordHash = await hashPassword('correct-password');
  const app = await createTestApp({
    pool: createPool({
      loginUser: { id: 1, display_name: 'Login User', profile_picture: null, session_version: 0, password_hash: passwordHash }
    })
  });
  const csrfToken = await getCsrfToken(app);

  const badBody = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: { 'x-csrf-token': csrfToken },
    payload: { userNumber: 'abc', password: 'correct-password' }
  });
  assert.equal(badBody.statusCode, 400);

  const success = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: { 'x-csrf-token': csrfToken },
    payload: { userNumber: '1', password: 'correct-password' }
  });
  assert.equal(success.statusCode, 200);
  assert.equal(success.json().user.id, 1);
  assert.match(getSetCookie(success), /chatfr\.session=.*HttpOnly/);
  await app.close();
});

test('session cookie authenticates and logout clears it', async () => {
  const app = await createTestApp();
  const csrfToken = await getCsrfToken(app);
  const signup = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    headers: { 'x-csrf-token': csrfToken },
    payload: { displayName: 'Test', password: 'long-enough-password' }
  });
  const cookie = getSetCookie(signup);

  const me = await app.inject({
    method: 'GET',
    url: '/api/me',
    headers: { cookie }
  });
  assert.equal(me.statusCode, 200);
  assert.equal(me.json().user.id, 1);

  const logout = await app.inject({
    method: 'POST',
    url: '/api/auth/logout',
    headers: { cookie, 'x-csrf-token': csrfToken }
  });
  assert.equal(logout.statusCode, 200);
  assert.match(getSetCookie(logout), /Max-Age=0/);

  const revoked = await app.inject({
    method: 'GET',
    url: '/api/me',
    headers: { cookie }
  });
  assert.equal(revoked.statusCode, 401);
  await app.close();
});

test('message creation rejects overlong content through schema validation', async () => {
  const app = await createTestApp();
  const csrfToken = await getCsrfToken(app);
  const response = await app.inject({
    method: 'POST',
    url: '/api/threads/global/messages',
    headers: { authorization: 'Bearer good-token', 'x-csrf-token': csrfToken },
    payload: { content: 'a'.repeat(2001) }
  });

  assert.equal(response.statusCode, 400);
  await app.close();
});

test('user lookup rejects malformed user numbers', async () => {
  const app = await createTestApp();
  const response = await app.inject({
    method: 'GET',
    url: '/api/users/not-a-number',
    headers: { authorization: 'Bearer good-token' }
  });

  assert.equal(response.statusCode, 400);
  await app.close();
});

test('unsafe routes reject missing csrf tokens', async () => {
  const app = await createTestApp();

  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/signup',
    payload: { displayName: 'Test', password: 'long-enough-password' }
  });

  assert.equal(response.statusCode, 403);
  await app.close();
});

function getSetCookie(response) {
  const header = response.headers['set-cookie'];
  return Array.isArray(header) ? header.join('; ') : String(header || '');
}
