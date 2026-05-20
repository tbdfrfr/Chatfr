import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeDisplayName } from '../src/auth.js';
import {
  normalizeGroupNameColor,
  normalizeGroupNameFont,
  normalizeProfilePictureInput,
  normalizeStoredProfilePicture
} from '../src/chatFormatting.js';
import { createMemoryRateLimiter } from '../src/rateLimit.js';
import { getSocketToken } from '../src/realtime/websocket.js';
import { createRateLimiter } from '../src/rateLimit.js';

test('normalizes display names safely', () => {
  assert.equal(normalizeDisplayName('  Alice  '), 'Alice');
  assert.equal(normalizeDisplayName(''), null);
  assert.equal(normalizeDisplayName(null), null);
  assert.equal(normalizeDisplayName('a'.repeat(50)), 'a'.repeat(40));
});

test('normalizes group styles to allowlisted values', () => {
  assert.equal(normalizeGroupNameColor('#E63946'), '#e63946');
  assert.equal(normalizeGroupNameColor('not-a-color'), '#eeeeee');
  assert.equal(normalizeGroupNameFont('Pacifico'), 'pacifico');
  assert.equal(normalizeGroupNameFont('wild-font'), 'space-grotesk');
});

test('validates profile picture grids', () => {
  const grid = Array.from({ length: 49 }, (_, index) => (index === 0 ? '#AABBCC' : null));
  const normalized = normalizeProfilePictureInput(grid);

  assert.equal(normalized[0], '#aabbcc');
  assert.throws(() => normalizeProfilePictureInput(['#ffffff']), /7x7/);
  assert.throws(() => normalizeProfilePictureInput(Array.from({ length: 49 }, () => 'red')), /hex/);
  assert.deepEqual(normalizeStoredProfilePicture(['bad']), null);
});

test('websocket auth ignores query string tokens', () => {
  const token = getSocketToken(
    {
      headers: {
        'sec-websocket-protocol': 'chatfr',
        cookie: 'chatfr.session=cookie-token'
      }
    }
  );

  assert.equal(token, 'cookie-token');
});

test('memory rate limiter blocks after configured message burst', async () => {
  const limiter = createMemoryRateLimiter();

  for (let index = 0; index < 5; index += 1) {
    assert.equal(await limiter.allowMessage(1), true);
  }

  assert.equal(await limiter.allowMessage(1), false);
});

test('production requires redis-backed rate limiting', async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';

  try {
    await assert.rejects(
      () => createRateLimiter({}),
      /REDIS_URL is required when RATE_LIMIT_STORE=redis/
    );
  } finally {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  }
});
