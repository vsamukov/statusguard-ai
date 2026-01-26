
import pool from '../lib/db.js';

export const auditService = {
  async log(username, actionType, targetType, targetName, details = {}) {
    try {
      await pool.query(
        'INSERT INTO audit_logs (username, action_type, target_type, target_name, details) VALUES ($1, $2, $3, $4, $5)',
        [username, actionType, targetType, targetName, JSON.stringify(details)]
      );
    } catch (err) {
      console.error('[AUDIT SERVICE ERROR]', err);
    }
  }
};
