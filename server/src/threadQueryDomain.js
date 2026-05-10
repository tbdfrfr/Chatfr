import { createThreadSummaryDomain } from './threadSummaryDomain.js';
import { createThreadAccessDomain } from './threadAccessDomain.js';

export function createThreadQueryDomain({ pool }) {
  const summaryDomain = createThreadSummaryDomain({ pool });
  const { getThreadSummary, getDirectLabel } = summaryDomain;
  const accessDomain = createThreadAccessDomain({ pool });
  const { canAccessThread } = accessDomain;

  async function listThreads(userId) {
    const result = await pool.query(
      `WITH visible_threads AS (
         SELECT t.*
         FROM threads t
         WHERE t.type = 'global'
         UNION
         SELECT t.*
         FROM threads t
         JOIN thread_members tm ON tm.thread_id = t.id
         WHERE tm.user_id = $1 AND t.type IN ('dm', 'group')
       )
       SELECT vt.*, m.content AS last_message_content, m.created_at AS last_message_created_at, m.user_id AS last_message_user_id
       FROM visible_threads vt
       LEFT JOIN LATERAL (
         SELECT *
         FROM messages
         WHERE thread_id = vt.id
         ORDER BY id DESC
         LIMIT 1
       ) m ON true
       ORDER BY COALESCE(m.created_at, vt.last_message_at) DESC`,
      [userId]
    );

    const threads = [];

    for (const thread of result.rows) {
      threads.push(await getThreadSummary(thread, userId));
    }

    return threads;
  }



  async function getThreadById(threadId, userId) {
    const result = await pool.query('SELECT * FROM threads WHERE id = $1', [threadId]);
    const thread = result.rows[0];

    if (!thread) {
      return null;
    }

    if (thread.type !== 'global') {
      const access = await canAccessThread(threadId, userId);
      if (!access) {
        return null;
      }
    }

    return getThreadSummary(thread, userId);
  }

  async function getThreadRow(threadId) {
    const result = await pool.query('SELECT * FROM threads WHERE id = $1', [threadId]);
    return result.rows[0] || null;
  }

  // getDirectLabel provided by threadSummaryDomain via summaryDomain.getDirectLabel

  return {
    canAccessThread,
    listThreads,
    getThreadSummary,
    getThreadById,
    getThreadRow,
    getDirectLabel
  };
}