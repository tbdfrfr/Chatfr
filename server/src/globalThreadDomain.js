export function createGlobalThreadDomain({ pool }) {
  async function joinGlobal(userId) {
    await pool.query("INSERT INTO thread_members (thread_id, user_id) VALUES ('global', $1) ON CONFLICT DO NOTHING", [userId]);
  }

  return {
    joinGlobal
  };
}
