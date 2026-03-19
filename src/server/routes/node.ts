
import { Router } from 'express';
import pool from '../services/db.js';
import { incidentService } from '../services/incidentService.js';
import { auditService, AuditAction } from '../services/auditService.js';
import { nodeAuth, AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { 
  loginSchema,
  incidentSchema, 
  regionSchema, 
  componentSchema, 
  subscriptionSchema, 
  templateSchema 
} from '../utils/schemas.js';

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config.js';

const router = Router();

router.post('/auth', validate(loginSchema), async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid Credentials' });
    }
    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid Credentials' });
    }

    const token = jwt.sign({ username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    
    res.cookie('vox_hub_session', token, { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none',
      maxAge: 24 * 60 * 60 * 1000 
    });
    
    res.json({ token, username: user.username });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/status', async (req, res) => {
  try {
    const regions = await pool.query('SELECT id, name FROM regions WHERE deleted_at IS NULL ORDER BY name ASC');
    const components = await pool.query('SELECT id, region_id as "regionId", name, description, created_at as "createdAt" FROM components WHERE deleted_at IS NULL ORDER BY name ASC');
    const incidentsRes = await pool.query('SELECT id, title, description, severity, start_time as "startTime", end_time as "endTime" FROM incidents ORDER BY start_time DESC');
    
    const incidents = [];
    for (const inc of incidentsRes.rows) {
      const compIdsRes = await pool.query('SELECT component_id FROM incident_affected_components WHERE incident_id = $1', [inc.id]);
      incidents.push({ ...inc, componentIds: compIdsRes.rows.map(r => r.component_id) });
    }

    res.json({ regions: regions.rows, components: components.rows, incidents });
  } catch (err: any) {
    console.error('[API ERROR] /api/status:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/admin/data', nodeAuth, async (req: AuthRequest, res) => {
  try {
    const templates = await pool.query('SELECT id, component_name as "componentName", name, title, description FROM templates');
    const auditLogs = await pool.query('SELECT id, username, action_type as "actionType", target_type as "targetType", target_name as "targetName", details, created_at as "createdAt" FROM audit_logs ORDER BY created_at DESC LIMIT 50');
    const settingsRows = await pool.query('SELECT key, value FROM notification_settings');
    const notificationSettings = {
      incidentNewTemplate: settingsRows.rows.find(r => r.key === 'incident_new_template')?.value || '',
      incidentResolvedTemplate: settingsRows.rows.find(r => r.key === 'incident_resolved_template')?.value || ''
    };
    res.json({ templates: templates.rows, auditLogs: auditLogs.rows, notificationSettings });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/admin/subscribers', nodeAuth, async (req: AuthRequest, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const offset = (page - 1) * limit;
  const search = req.query.search ? `%${req.query.search}%` : '%';
  try {
    const countRes = await pool.query('SELECT count(*) FROM subscriptions WHERE email LIKE $1', [search]);
    const itemsRes = await pool.query('SELECT id, email, created_at as "createdAt" FROM subscriptions WHERE email LIKE $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3', [search, limit, offset]);
    res.json({ total: parseInt(countRes.rows[0].count), items: itemsRes.rows });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/admin/incidents', nodeAuth, validate(incidentSchema), async (req: AuthRequest, res) => {
  try {
    const incident = await incidentService.createIncident(req.user.username, req.body);
    res.json(incident);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/admin/incidents/:id', nodeAuth, async (req: AuthRequest, res) => {
  try {
    const incident = await incidentService.updateIncident(req.user.username, req.params.id, req.body);
    res.json(incident);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/admin/incidents/:id/resolve', nodeAuth, async (req: AuthRequest, res) => {
  try {
    const incident = await incidentService.resolveIncident(req.user.username, req.params.id);
    res.json(incident);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/admin/regions', nodeAuth, validate(regionSchema), async (req: AuthRequest, res) => {
  try {
    const result = await pool.query('INSERT INTO regions (name) VALUES ($1) RETURNING id, name', [req.body.name]);
    await auditService.log(req.user.username, AuditAction.CREATE_REGION, 'REGION', req.body.name);
    res.json(result.rows[0]);
  } catch (err: any) { res.status(500).json({ error: 'Internal Server Error' }); }
});

router.delete('/admin/regions/:id', nodeAuth, async (req: AuthRequest, res) => {
  try {
    const region = await pool.query('SELECT name FROM regions WHERE id = $1', [req.params.id]);
    await pool.query('UPDATE regions SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [req.params.id]);
    await auditService.log(req.user.username, AuditAction.DELETE_REGION, 'REGION', region.rows[0]?.name);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: 'Internal Server Error' }); }
});

router.post('/admin/components', nodeAuth, validate(componentSchema), async (req: AuthRequest, res) => {
  try {
    const { regionId, name, description } = req.body;
    const result = await pool.query('INSERT INTO components (region_id, name, description) VALUES ($1, $2, $3) RETURNING id, region_id as "regionId", name, description', [regionId, name, description]);
    await auditService.log(req.user.username, AuditAction.CREATE_COMPONENT, 'COMPONENT', name);
    res.json(result.rows[0]);
  } catch (err: any) { res.status(500).json({ error: 'Internal Server Error' }); }
});

router.put('/admin/components/:id', nodeAuth, validate(componentSchema), async (req: AuthRequest, res) => {
  try {
    const { name, description } = req.body;
    const result = await pool.query('UPDATE components SET name=$1, description=$2 WHERE id=$3 RETURNING id, region_id as "regionId", name, description', [name, description, req.params.id]);
    await auditService.log(req.user.username, AuditAction.UPDATE_COMPONENT, 'COMPONENT', name);
    res.json(result.rows[0]);
  } catch (err: any) { res.status(500).json({ error: 'Internal Server Error' }); }
});

router.delete('/admin/components/:id', nodeAuth, async (req: AuthRequest, res) => {
  try {
    const comp = await pool.query('SELECT name FROM components WHERE id = $1', [req.params.id]);
    await pool.query('UPDATE components SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [req.params.id]);
    await auditService.log(req.user.username, AuditAction.DELETE_COMPONENT, 'COMPONENT', comp.rows[0]?.name);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: 'Internal Server Error' }); }
});

router.post('/subscriptions', validate(subscriptionSchema), async (req, res) => {
  try {
    const result = await pool.query('INSERT INTO subscriptions (email) VALUES ($1) ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email RETURNING id, email, created_at as "createdAt"', [req.body.email]);
    res.json(result.rows[0]);
  } catch (err: any) { res.status(500).json({ error: 'Internal Server Error' }); }
});

// Secure public unsubscribe via token
router.get('/unsubscribe', async (req, res) => {
  const { email, token } = req.query;
  if (!email || !token || typeof email !== 'string' || typeof token !== 'string') {
    return res.status(400).send('Invalid unsubscribe request');
  }

  const { subscriptionService } = await import('../services/subscriptionService.js');
  if (subscriptionService.verifyUnsubscribeToken(email, token)) {
    try {
      await pool.query('DELETE FROM subscriptions WHERE email = $1', [email]);
      res.send('You have been successfully unsubscribed.');
    } catch (err) {
      res.status(500).send('Error processing unsubscribe');
    }
  } else {
    res.status(403).send('Invalid or expired unsubscribe token');
  }
});

router.delete('/admin/subscriptions/:id', nodeAuth, async (req: AuthRequest, res) => {
  try {
    await pool.query('DELETE FROM subscriptions WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: 'Internal Server Error' }); }
});

router.post('/admin/notification-settings', nodeAuth, async (req: AuthRequest, res) => {
  try {
    const { incidentNewTemplate, incidentResolvedTemplate } = req.body;
    await pool.query('INSERT INTO notification_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', ['incident_new_template', incidentNewTemplate]);
    await pool.query('INSERT INTO notification_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', ['incident_resolved_template', incidentResolvedTemplate]);
    await auditService.log(req.user.username, AuditAction.UPDATE_SETTINGS, 'SETTINGS', 'Notification Templates');
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: 'Internal Server Error' }); }
});

router.post('/admin/templates', nodeAuth, validate(templateSchema), async (req: AuthRequest, res) => {
  try {
    const { componentName, name, title, description } = req.body;
    const resT = await pool.query('INSERT INTO templates (component_name, name, title, description) VALUES ($1, $2, $3, $4) RETURNING id, component_name as "componentName", name, title, description', [componentName, name, title, description]);
    await auditService.log(req.user.username, AuditAction.CREATE_TEMPLATE, 'TEMPLATE', name);
    res.json(resT.rows[0]);
  } catch (err: any) { res.status(500).json({ error: 'Internal Server Error' }); }
});

router.put('/admin/templates/:id', nodeAuth, validate(templateSchema), async (req: AuthRequest, res) => {
  try {
    const { componentName, name, title, description } = req.body;
    const resT = await pool.query('UPDATE templates SET component_name=$1, name=$2, title=$3, description=$4 WHERE id=$5 RETURNING id, component_name as "componentName", name, title, description', [componentName, name, title, description, req.params.id]);
    await auditService.log(req.user.username, AuditAction.UPDATE_TEMPLATE, 'TEMPLATE', name);
    res.json(resT.rows[0]);
  } catch (err: any) { res.status(500).json({ error: 'Internal Server Error' }); }
});

router.delete('/admin/templates/:id', nodeAuth, async (req: AuthRequest, res) => {
  try {
    const temp = await pool.query('SELECT name FROM templates WHERE id = $1', [req.params.id]);
    await pool.query('DELETE FROM templates WHERE id = $1', [req.params.id]);
    await auditService.log(req.user.username, AuditAction.DELETE_TEMPLATE, 'TEMPLATE', temp.rows[0]?.name);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: 'Internal Server Error' }); }
});

export default router;
