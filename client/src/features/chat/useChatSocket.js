import { useEffect } from 'react';
import { connectChatSocket } from '../../lib/socket.js';

export function useChatSocket({ token, meId, onMessage, onUserUpdate, onMeChange }) {
  useEffect(() => {
    const socket = connectChatSocket(token, (payload) => {
      if (payload.type === 'message:new') {
        onMessage(payload);
      } else if (payload.type === 'user:updated' && payload.user) {
        onUserUpdate(payload.user);
        if (Number(payload.user.id) === Number(meId)) {
          onMeChange((previous) => ({ ...(previous || {}), ...payload.user }));
        }
      }
    });

    return () => socket.close();
  }, [token, meId, onMessage, onUserUpdate, onMeChange]);
}
