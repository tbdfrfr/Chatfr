export function createThreadAccessDomain({ pool }) {
  async function canAccessThread(threadId, userId) {
    if (threadId === 'global') {
      return true;
    }

    const result = await pool.query('SELECT 1 FROM thread_members WHERE thread_id = $1 AND user_id = $2', [threadId, userId]);
    return result.rowCount > 0;
  }

  async function usersShareThread(aUserId, bUserId) {
    if (Number(aUserId) === Number(bUserId)) {
      return true;
    }

    const result = await pool.query(
      `SELECT 1
       FROM thread_members tm1
       JOIN thread_members tm2 ON tm2.thread_id = tm1.thread_id
       WHERE tm1.user_id = $1 AND tm2.user_id = $2
       LIMIT 1`,
      [aUserId, bUserId]
    );

    return result.rowCount > 0;
  }

  return {
    canAccessThread,
    usersShareThread
  };
}
