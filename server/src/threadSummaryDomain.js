import { normalizeGroupNameColor, normalizeGroupNameFont } from './chatFormatting.js';
import { toUserPayload } from './userPayload.js';

export function createThreadSummaryDomain({ pool }) {
  async function getThreadSummary(thread, userId) {
    if (thread.type === 'global') {
      return {
        id: thread.id,
        type: thread.type,
        name: thread.name,
        members: [],
        lastMessage: thread.last_message_content
          ? {
              content: thread.last_message_content,
              createdAt: thread.last_message_created_at,
              userId: thread.last_message_user_id
            }
          : null
      };
    }

    const members = await pool.query(
      `SELECT u.id, u.display_name, u.profile_picture
       FROM thread_members tm
       JOIN users u ON u.id = tm.user_id
       WHERE tm.thread_id = $1
       ORDER BY u.id ASC`,
      [thread.id]
    );

    return {
      id: thread.id,
      type: thread.type,
      name: thread.name,
      nameColor: normalizeGroupNameColor(thread.name_color),
      nameFont: normalizeGroupNameFont(thread.name_font),
      createdBy: thread.created_by ? Number(thread.created_by) : null,
      members: members.rows.map(toUserPayload),
      lastMessage: thread.last_message_content
        ? {
            content: thread.last_message_content,
            createdAt: thread.last_message_created_at,
            userId: thread.last_message_user_id
          }
        : null,
      directLabel: thread.type === 'dm' ? getDirectLabel(members.rows, userId) : null
    };
  }

  function getDirectLabel(members, userId) {
    const other = members.find((member) => Number(member.id) !== Number(userId)) || members[0];
    if (!other) {
      return null;
    }

    return other.display_name || `#${other.id}`;
  }

  return {
    getThreadSummary
  };
}
