
import pool from './db.js';

export enum AuditAction {
  CREATE_REGION = 'CREATE_REGION',
  DELETE_REGION = 'DELETE_REGION',
  CREATE_COMPONENT = 'CREATE_COMPONENT',
  DELETE_COMPONENT = 'DELETE_COMPONENT',
  CREATE_INCIDENT = 'CREATE_INCIDENT',
  UPDATE_INCIDENT = 'UPDATE_INCIDENT',
  RESOLVE_INCIDENT = 'RESOLVE_INCIDENT',
  UPDATE_SETTINGS = 'UPDATE_SETTINGS',
  CREATE_TEMPLATE = 'CREATE_TEMPLATE',
  UPDATE_TEMPLATE = 'UPDATE_TEMPLATE',
  DELETE_TEMPLATE = 'DELETE_TEMPLATE',
}

export const auditService = {
  async log(username: string, actionType: AuditAction, targetType: string, targetName: string, details?: string) {
    try {
      await pool.query(
        'INSERT INTO audit_logs (username, action_type, target_type, target_name, details) VALUES ($1, $2, $3, $4, $5)',
        [username, actionType, targetType, targetName, details]
      );
    } catch (err) {
      console.error('[AUDIT ERROR]', err);
    }
  }
};
