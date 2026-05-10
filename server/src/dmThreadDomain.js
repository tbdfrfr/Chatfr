export function createDmThreadDomain({ pool, getThreadById }) {
  async function getOrCreateDmThread(userId, otherUserId) {
    const key = [userId, otherUserId].sort((a, b) => a - b).join(':');
    const threadId = `dm_${key}`;

    await pool.query(
      `INSERT INTO threads (id, type, name, created_by, dm_key)
       VALUES ($1, 'dm', NULL, $2, $3)
       ON CONFLICT (dm_key) DO NOTHING`,
      [threadId, userId, key]
    );

    const thread = await pool.query('SELECT * FROM threads WHERE dm_key = $1', [key]);
    const id = thread.rows[0].id;

    await pool.query('INSERT INTO thread_members (thread_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, userId]);
    await pool.query('INSERT INTO thread_members (thread_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, otherUserId]);

    return await getThreadById(id, userId);
  }

  return {
    getOrCreateDmThread
  };
}
