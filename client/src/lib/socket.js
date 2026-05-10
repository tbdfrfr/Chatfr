import { websocketUrl } from './api.js';

export function connectChatSocket(token, onMessage) {
  const socket = new WebSocket(websocketUrl('/ws', token));

  socket.addEventListener('message', (event) => {
    try {
      onMessage(JSON.parse(event.data));
    } catch {
      // Ignore malformed socket payloads.
    }
  });

  return socket;
}