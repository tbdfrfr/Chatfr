import { useEffect } from 'react';
import { connectChatSocket } from '../../lib/socket.js';

export function useChatSocket({ meId, onMessage, onUserUpdate, onMeChange }) {
  useEffect(() => {
    const socket = connectChatSocket((payload) => {
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
  }, [meId, onMessage, onUserUpdate, onMeChange]);
}
