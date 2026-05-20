import { websocketUrl } from './api.js';

export function connectChatSocket(onMessage) {
  const socket = new WebSocket(websocketUrl('/ws'), ['chatfr']);

  socket.addEventListener('message', (event) => {
    try {
      onMessage(JSON.parse(event.data));
    } catch {
      // Ignore malformed socket payloads.
    }
  });

  return socket;
}
