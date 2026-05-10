export function createUserQueryDomain({ pool }) {
  async function getUser(userId) {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    return result.rows[0] || null;
  }

  return {
    getUser
  };
}
