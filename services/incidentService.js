
import pool, { withTransaction } from '../lib/db.js';
import { auditService } from './auditService.js';
import SubscriptionService from './subscriptionService.js';

const notifications = new SubscriptionService();

export const incidentService = {
  async createIncident(username, data) {
    return await withTransaction(async (client) => {
      // 1. Create incident
      const res = await client.query(
        'INSERT INTO incidents (component_id, title, description, severity, start_time, end_time) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        [data.componentId, data.title, data.description, data.severity, data.startTime, data.endTime]
      );
      
      const incidentId = res.rows[0].id;

      // 2. Log audit - Highlighted RED in UI
      await auditService.log(username, 'CREATE_INCIDENT', 'INCIDENT', data.title, { severity: data.severity });

      // 3. Notify (Async)
      this.notify(incidentId, 'NEW');

      return res.rows[0];
    });
  },

  async updateIncident(username, id, data) {
    return await withTransaction(async (client) => {
      // Fetch the existing record to allow partial updates
      const currentRes = await client.query('SELECT * FROM incidents WHERE id = $1', [id]);
      if (currentRes.rows.length === 0) throw new Error('Incident not found');
      
      const row = currentRes.rows[0];
      const wasResolved = row.end_time !== null;

      // Merge provided data with existing row data (handle partial updates)
      const title = data.title !== undefined ? data.title : row.title;
      const description = data.description !== undefined ? data.description : row.description;
      const severity = data.severity !== undefined ? data.severity : row.severity;
      const startTime = data.startTime !== undefined ? data.startTime : row.start_time;
      const endTime = data.endTime !== undefined ? data.endTime : row.end_time;
      const componentId = data.componentId !== undefined ? data.componentId : row.component_id;

      const res = await client.query(
        'UPDATE incidents SET title=$1, description=$2, severity=$3, start_time=$4, end_time=$5, component_id=$6 WHERE id=$7 RETURNING id',
        [title, description, severity, startTime, endTime, componentId, id]
      );

      const isNowResolved = endTime !== null;
      const isNewlyResolved = isNowResolved && !wasResolved;
      
      // Determine audit action type: RESOLVE_INCIDENT vs UPDATE_INCIDENT
      const actionType = isNewlyResolved ? 'RESOLVE_INCIDENT' : 'UPDATE_INCIDENT';
      await auditService.log(username, actionType, 'INCIDENT', title);

      if (isNewlyResolved) {
        this.notify(id, 'RESOLVED');
      }

      return res.rows[0];
    });
  },

  async notify(incidentId, type) {
    try {
      const subscribersRes = await pool.query('SELECT email FROM subscriptions');
      const recipients = subscribersRes.rows.map(r => r.email);
      if (recipients.length === 0) return;

      const incidentRes = await pool.query(`
        SELECT i.*, c.name as comp_name, s.name as svc_name, r.name as reg_name
        FROM incidents i
        JOIN components c ON i.component_id = c.id
        JOIN services s ON c.service_id = s.id
        JOIN regions r ON s.region_id = r.id
        WHERE i.id = $1
      `, [incidentId]);
      
      if (incidentRes.rows.length === 0) return;
      const incident = incidentRes.rows[0];

      const templateKey = type === 'NEW' ? 'incident_new_template' : 'incident_resolved_template';
      const templateRes = await pool.query('SELECT value FROM notification_settings WHERE key = $1', [templateKey]);
      let messageHtml = templateRes.rows[0]?.value || 'Voximplant Status Update';

      const placeholders = {
        '{title}': incident.title,
        '{component}': incident.comp_name,
        '{service}': incident.svc_name,
        '{region}': incident.reg_name,
        '{severity}': incident.severity
      };

      Object.entries(placeholders).forEach(([key, val]) => {
        const regex = new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        messageHtml = messageHtml.replace(regex, val || '');
      });

      const subject = type === 'NEW' ? `[Issue] ${incident.title}` : `[Resolved] ${incident.title}`;
      
      await notifications.sendBroadcast({
        fromEmail: process.env.SMTP_FROM || 'status@voximplant.com',
        subject,
        recipients,
        html: `<div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
          <h2 style="color: #4f46e5;">Status Update</h2>
          <p style="white-space: pre-wrap;">${messageHtml}</p>
        </div>`
      });
    } catch (err) {
      console.error('[INCIDENT SERVICE NOTIFY ERROR]', err);
    }
  }
};
