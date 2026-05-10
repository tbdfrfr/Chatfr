import { WebSocketServer } from 'ws';

export function registerWebsocketServer(server, options) {
  const { clients, isAllowedWebSocketOrigin, verifyToken } = options;
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
}
