import { toUserPayload } from './userPayload.js';

export function createMessageDomain({ pool }) {
  async function hydrateMessage(messageId) {
    const result = await pool.query(
      `SELECT m.*, u.display_name, u.profile_picture
       FROM messages m
       JOIN users u ON u.id = m.user_id
       WHERE m.id = $1`,
      [messageId]
    );

    return formatMessage(result.rows[0]);
  }

  function formatMessage(message) {
    return {
      id: Number(message.id),
      threadId: message.thread_id,
      user: toUserPayload({ id: message.user_id, display_name: message.display_name, profile_picture: message.profile_picture }),
      content: message.content,
      createdAt: message.created_at
    };
  }

  return {
    hydrateMessage,
    formatMessage
  };
}