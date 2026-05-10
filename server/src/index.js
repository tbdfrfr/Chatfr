import dotenv from 'dotenv';
import { createPool } from './db.js';
import { ensureSchema } from './schema.js';
import {
  assertEnv,
  verifyToken
} from './auth.js';
import { createDomainServices } from './domainServices.js';
import { createApp } from './app.js';
import { registerWebsocketServer } from './realtime/websocket.js';
import { toUserPayload } from './userPayload.js';

dotenv.config();
assertEnv();

const pool = createPool();
const clients = new Map();
const domainServices = createDomainServices({ pool, clientOrigin: process.env.CLIENT_ORIGIN, clients });
const { isAllowedWebSocketOrigin, seedTbdAccountProfilePicture } = domainServices;

await ensureSchema(pool);
await seedTbdAccountProfilePicture();

const app = await createApp({
  pool,
  domainServices,
  toUserPayload,
  verifyToken,
  clientOrigin: process.env.CLIENT_ORIGIN
});

registerWebsocketServer(app.server, {
  clients,
  isAllowedWebSocketOrigin,
  verifyToken
});

const port = Number(process.env.PORT || 3001);
await app.listen({ port, host: '0.0.0.0' });


