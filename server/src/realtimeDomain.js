import { WebSocket } from 'ws';
import { toUserPayload } from './userPayload.js';

export function createRealtimeDomain({ clients = new Map(), clientOrigin, canAccessThread, usersShareThread }) {
  const clientOriginAllowlist = new Set(
    String(clientOrigin || '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
  );

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
    if (!user) {
      return;
    }

    const payload = JSON.stringify({ type: 'user:updated', user });

    for (const [socket, viewerId] of clients.entries()) {
      if (socket.readyState !== WebSocket.OPEN) {
        continue;
      }

      usersShareThread(user.id, viewerId)
        .then((sharedThread) => {
          if (sharedThread && socket.readyState === WebSocket.OPEN) {
            socket.send(payload);
          }
        })
        .catch(() => {
        });
    }
  }

  function isAllowedWebSocketOrigin(origin) {
    if (clientOriginAllowlist.size === 0) {
      return true;
    }

    if (typeof origin !== 'string' || !origin.trim()) {
      return false;
    }

    return clientOriginAllowlist.has(origin);
  }

  return {
    broadcastThreadUpdate,
    broadcastUserUpdate,
    isAllowedWebSocketOrigin
  };
}