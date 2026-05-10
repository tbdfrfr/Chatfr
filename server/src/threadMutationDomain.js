export function createThreadMutationDomain({ pool, getThreadRow }) {
  async function leaveThread(threadId, userId) {
    const thread = await getThreadRow(threadId);

    if (!thread) {
      return { deleted: true };
    }

    if (thread.type === 'dm') {
      await pool.query('DELETE FROM threads WHERE id = $1', [threadId]);
      return { deleted: true };
    }

    await pool.query('DELETE FROM thread_members WHERE thread_id = $1 AND user_id = $2', [threadId, userId]);

    const remaining = await pool.query('SELECT COUNT(*)::int AS count FROM thread_members WHERE thread_id = $1', [threadId]);
    if (remaining.rows[0].count === 0) {
      await pool.query('DELETE FROM threads WHERE id = $1', [threadId]);
      return { deleted: true };
    }

    return { deleted: true };
  }

  return {
    leaveThread
  };
}