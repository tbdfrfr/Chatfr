import { WebSocketServer } from 'ws';
import { getSessionTokenFromCookieHeader, normalizeVerifiedToken } from '../auth.js';

export function registerWebsocketServer(server, options) {
  const { clients, isAllowedWebSocketOrigin, verifyToken, getUser } = options;
  const sockets = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, 'http://localhost');

    if (url.pathname !== '/ws') {
      socket.destroy();
      return;
    }

    if (!isAllowedWebSocketOrigin(request.headers.origin)) {
      socket.destroy();
      return;
    }

    sockets.handleUpgrade(request, socket, head, (websocket) => {
      sockets.emit('connection', websocket, request);
    });
  });

  sockets.on('connection', async (socket, request) => {
    const token = getSocketToken(request);

    if (!token) {
      socket.close();
      return;
    }

    let userId;

    try {
      const verified = normalizeVerifiedToken(verifyToken(token));
      const currentUser = getUser ? await getUser(verified.userId) : null;

      if (!currentUser || Number(currentUser.session_version ?? 0) !== verified.sessionVersion) {
        socket.close();
        return;
      }

      userId = verified.userId;
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
}

export function getSocketToken(request) {
  const protocolToken = String(request.headers['sec-websocket-protocol'] || '')
    .split(',')
    .map((protocol) => protocol.trim())
    .find((protocol) => protocol && protocol !== 'chatfr');

  return protocolToken || getSessionTokenFromCookieHeader(request.headers.cookie);
}
