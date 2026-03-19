
import pool, { withTransaction } from './db.js';
import { auditService, AuditAction } from './auditService.js';
import { subscriptionService } from './subscriptionService.js';

export const incidentService = {
  async createIncident(username: string, data: any) {
    return await withTransaction(async (client) => {
      const res = await client.query(
        'INSERT INTO incidents (title, description, severity, start_time, end_time) VALUES ($1, $2, $3, $4, $5) RETURNING id, title, description, severity, start_time as "startTime", end_time as "endTime"',
        [data.title, data.description, data.severity, data.startTime, data.endTime]
      );
      const incidentId = res.rows[0].id;
      
      if (data.componentIds && Array.isArray(data.componentIds)) {
        for (const compId of data.componentIds) {
          await client.query('INSERT INTO incident_affected_components (incident_id, component_id) VALUES ($1, $2)', [incidentId, compId]);
        }
      }

      await auditService.log(username, AuditAction.CREATE_INCIDENT, 'INCIDENT', data.title, JSON.stringify({ severity: data.severity }));
      await this.notify(incidentId, 'NEW');
      
      return { ...res.rows[0], componentIds: data.componentIds || [] };
    });
  },

  async updateIncident(username: string, id: string, data: any) {
    return await withTransaction(async (client) => {
      const currentRes = await client.query('SELECT * FROM incidents WHERE id = $1', [id]);
      if (currentRes.rows.length === 0) throw new Error('Incident not found');
      
      const row = currentRes.rows[0];
      const wasResolved = row.end_time !== null;

      const title = data.title !== undefined ? data.title : row.title;
      const description = data.description !== undefined ? data.description : row.description;
      const severity = data.severity !== undefined ? data.severity : row.severity;
      const startTime = data.startTime !== undefined ? data.startTime : row.start_time;
      const endTime = data.endTime !== undefined ? data.endTime : row.end_time;

      const res = await client.query(
        'UPDATE incidents SET title=$1, description=$2, severity=$3, start_time=$4, end_time=$5 WHERE id=$6 RETURNING id, title, description, severity, start_time as "startTime", end_time as "endTime"',
        [title, description, severity, startTime, endTime, id]
      );

      if (data.componentIds && Array.isArray(data.componentIds)) {
        await client.query('DELETE FROM incident_affected_components WHERE incident_id = $1', [id]);
        for (const compId of data.componentIds) {
          await client.query('INSERT INTO incident_affected_components (incident_id, component_id) VALUES ($1, $2)', [id, compId]);
        }
      }

      const isNowResolved = endTime !== null;
      const isNewlyResolved = isNowResolved && !wasResolved;
      
      const actionType = isNewlyResolved ? AuditAction.RESOLVE_INCIDENT : AuditAction.UPDATE_INCIDENT;
      await auditService.log(username, actionType, 'INCIDENT', title);

      if (isNewlyResolved) {
        await this.notify(id, 'RESOLVED');
      }
      
      const compIdsRes = await client.query('SELECT component_id FROM incident_affected_components WHERE incident_id = $1', [id]);
      return { ...res.rows[0], componentIds: compIdsRes.rows.map(r => r.component_id) };
    });
  },

  async resolveIncident(username: string, id: string) {
    return this.updateIncident(username, id, { endTime: new Date().toISOString() });
  },

  async notify(incidentId: string, type: 'NEW' | 'RESOLVED') {
    try {
      const subscribersRes = await pool.query('SELECT email FROM subscriptions');
      const recipients = subscribersRes.rows.map(r => r.email);
      if (recipients.length === 0) return;

      const incidentRes = await pool.query('SELECT * FROM incidents WHERE id = $1', [incidentId]);
      if (incidentRes.rows.length === 0) return;
      const incident = incidentRes.rows[0];

      const compsRes = await pool.query(`
        SELECT c.name as comp_name, r.name as reg_name
        FROM incident_affected_components iac
        JOIN components c ON iac.component_id = c.id
        JOIN regions r ON c.region_id = r.id
        WHERE iac.incident_id = $1
      `, [incidentId]);
      
      const affectedInfo = compsRes.rows.map(r => `${r.comp_name} (${r.reg_name})`).join(', ');

      const templateKey = type === 'NEW' ? 'incident_new_template' : 'incident_resolved_template';
      const templateRes = await pool.query('SELECT value FROM notification_settings WHERE key = $1', [templateKey]);
      let messageHtml = templateRes.rows[0]?.value || 'Voximplant Status Update';

      const placeholders: Record<string, string> = {
        '{title}': incident.title,
        '{component}': affectedInfo,
        '{region}': compsRes.rows[0]?.reg_name || 'Global',
        '{severity}': incident.severity
      };

      Object.entries(placeholders).forEach(([key, val]) => {
        const regex = new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        messageHtml = messageHtml.replace(regex, val || '');
      });

      const subject = type === 'NEW' ? `[Issue] ${incident.title}` : `[Resolved] ${incident.title}`;
      
      await subscriptionService.sendBroadcast({
        fromEmail: process.env.SMTP_FROM || 'status@voximplant.com',
        subject,
        recipients,
        html: `<div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
          <h2 style="color: #4f46e5;">Status Update</h2>
          <p style="white-space: pre-wrap;">${messageHtml}</p>
        </div>`
      });
    } catch (err) { console.error('[NOTIFY ERROR]', err); }
  }
};
