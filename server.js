
import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import * as esbuild from 'esbuild';
import pool, { waitForDb } from './lib/db.js';
import crypto from 'crypto';
import { incidentService } from './services/incidentService.js';
import { auditService } from './services/auditService.js';

const app = express();
const rootPath = path.resolve();

app.use(express.json());
app.use(cookieParser());

/**
 * AUTHENTICATION
 */
const sessions = new Map();

const authenticate = (req, res, next) => {
  const token = req.cookies.session_id || req.headers.authorization?.split(' ')[1];
  const username = sessions.get(token);
  if (!username) return res.status(401).json({ error: 'Unauthorized' });
  req.user = username;
  next();
};

/**
 * TRANSPILATION MIDDLEWARE
 */
app.use(async (req, res, next) => {
  const cleanPath = req.path.split('?')[0];
  if (cleanPath.endsWith('.ts') || cleanPath.endsWith('.tsx')) {
    const filePath = path.join(rootPath, cleanPath.startsWith('/') ? cleanPath.substring(1) : cleanPath);
    if (!fs.existsSync(filePath)) return next();
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const result = await esbuild.transform(content, {
        loader: cleanPath.endsWith('.tsx') ? 'tsx' : 'ts',
        format: 'esm',
        target: 'es2020',
        sourcemap: 'inline',
        define: { 'process.env.API_KEY': JSON.stringify(process.env.API_KEY || '') }
      });
      res.type('application/javascript').send(result.code);
    } catch (err) {
      console.error(`Transpilation failed for ${cleanPath}:`, err);
      res.status(500).send(`console.error("Transpilation failed for ${cleanPath}");`);
    }
  } else {
    next();
  }
});

/**
 * API ROUTES
 */

// Public Status
app.get('/api/status', async (req, res) => {
  try {
    const [regions, services, components, incidents, templates, settings] = await Promise.all([
      pool.query('SELECT id, name FROM regions ORDER BY name'),
      pool.query('SELECT id, region_id AS "regionId", name, description FROM services ORDER BY name'),
      pool.query('SELECT id, service_id AS "serviceId", name, description, created_at AS "createdAt" FROM components ORDER BY name'),
      pool.query('SELECT id, component_id AS "componentId", title, description, severity, start_time AS "startTime", end_time AS "endTime" FROM incidents ORDER BY start_time DESC'),
      pool.query('SELECT id, component_name AS "componentName", name, title, description FROM templates ORDER BY name'),
      pool.query('SELECT key, value FROM notification_settings'),
    ]);
    const notifySettings = {};
    settings.rows.forEach(r => {
      if (r.key === 'incident_new_template') notifySettings.incidentNewTemplate = r.value;
      if (r.key === 'incident_resolved_template') notifySettings.incidentResolvedTemplate = r.value;
    });
    res.json({ 
      regions: regions.rows, 
      services: services.rows, 
      components: components.rows, 
      incidents: incidents.rows, 
      templates: templates.rows, 
      notificationSettings: notifySettings 
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Public Subscriptions
app.post('/api/subscriptions', async (req, res) => {
  const { email } = req.body;
  try {
    await pool.query('INSERT INTO subscriptions (email) VALUES ($1) ON CONFLICT (email) DO NOTHING', [email]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/subscriptions/unsubscribe', async (req, res) => {
  const { email } = req.body;
  try {
    await pool.query('DELETE FROM subscriptions WHERE email = $1', [email]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Auth
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const [salt, hash] = rows[0].password_hash.split(':');
    const derived = crypto.scryptSync(password, salt, 64).toString('hex');
    if (derived !== hash) return res.status(401).json({ error: 'Invalid credentials' });
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, username);
    res.cookie('session_id', token, { httpOnly: true, secure: false });
    res.json({ token, username });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin Core Data
app.get('/api/admin/data', authenticate, async (req, res) => {
  try {
    const [users, auditLogs] = await Promise.all([
      pool.query('SELECT id, username, created_at AS "createdAt" FROM users ORDER BY username'),
      pool.query('SELECT id, username, action_type AS "actionType", target_type AS "targetType", target_name AS "targetName", details, created_at AS "createdAt" FROM audit_logs ORDER BY created_at DESC LIMIT 100'),
    ]);
    res.json({ users: users.rows, auditLogs: auditLogs.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin Subscriber Management
app.get('/api/admin/subscribers', authenticate, async (req, res) => {
  const { page = 1, limit = 10, search = '' } = req.query;
  const offset = (page - 1) * limit;
  const searchQuery = `%${search}%`;
  try {
    const countRes = await pool.query('SELECT COUNT(*) FROM subscriptions WHERE email ILIKE $1', [searchQuery]);
    const listRes = await pool.query(
      'SELECT id, email, created_at AS "createdAt" FROM subscriptions WHERE email ILIKE $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [searchQuery, limit, offset]
    );
    res.json({
      items: listRes.rows,
      total: parseInt(countRes.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/subscriptions', authenticate, async (req, res) => {
  const { email } = req.body;
  try {
    const result = await pool.query('INSERT INTO subscriptions (email) VALUES ($1) RETURNING id, email, created_at AS "createdAt"', [email]);
    await auditService.log(req.user, 'CREATE_SUBSCRIBER', 'SUBSCRIPTION', email);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/admin/subscriptions/:id', authenticate, async (req, res) => {
  const { email } = req.body;
  try {
    const result = await pool.query('UPDATE subscriptions SET email = $1 WHERE id = $2 RETURNING id, email, created_at AS "createdAt"', [email, req.params.id]);
    await auditService.log(req.user, 'UPDATE_SUBSCRIBER', 'SUBSCRIPTION', email);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/subscriptions/:id', authenticate, async (req, res) => {
  try {
    const check = await pool.query('SELECT email FROM subscriptions WHERE id = $1', [req.params.id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    await pool.query('DELETE FROM subscriptions WHERE id = $1', [req.params.id]);
    await auditService.log(req.user, 'DELETE_SUBSCRIBER', 'SUBSCRIPTION', check.rows[0].email);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin Settings
app.post('/api/admin/notification-settings', authenticate, async (req, res) => {
  const { incidentNewTemplate, incidentResolvedTemplate } = req.body;
  try {
    await pool.query('INSERT INTO notification_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['incident_new_template', incidentNewTemplate]);
    await pool.query('INSERT INTO notification_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', ['incident_resolved_template', incidentResolvedTemplate]);
    await auditService.log(req.user, 'UPDATE_SETTINGS', 'SYSTEM', 'Notification Templates');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin Infrastructure (Simplified for brevity but required for full functionality)
app.post('/api/admin/regions', authenticate, async (req, res) => {
  try {
    const resReg = await pool.query('INSERT INTO regions (name) VALUES ($1) RETURNING *', [req.body.name]);
    await auditService.log(req.user, 'CREATE_REGION', 'REGION', req.body.name);
    res.json(resReg.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/admin/regions/:id', authenticate, async (req, res) => {
  try {
    await pool.query('DELETE FROM regions WHERE id = $1', [req.params.id]);
    await auditService.log(req.user, 'DELETE_REGION', 'REGION', req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/admin/services', authenticate, async (req, res) => {
  try {
    const resSvc = await pool.query('INSERT INTO services (region_id, name, description) VALUES ($1, $2, $3) RETURNING *', [req.body.regionId, req.body.name, req.body.description]);
    await auditService.log(req.user, 'CREATE_SERVICE', 'SERVICE', req.body.name);
    res.json(resSvc.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/admin/services/:id', authenticate, async (req, res) => {
  try {
    await pool.query('DELETE FROM services WHERE id = $1', [req.params.id]);
    await auditService.log(req.user, 'DELETE_SERVICE', 'SERVICE', req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/admin/components', authenticate, async (req, res) => {
  try {
    const resComp = await pool.query('INSERT INTO components (service_id, name, description) VALUES ($1, $2, $3) RETURNING *', [req.body.serviceId, req.body.name, req.body.description]);
    await auditService.log(req.user, 'CREATE_COMPONENT', 'COMPONENT', req.body.name);
    res.json(resComp.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/admin/components/:id', authenticate, async (req, res) => {
  try {
    await pool.query('DELETE FROM components WHERE id = $1', [req.params.id]);
    await auditService.log(req.user, 'DELETE_COMPONENT', 'COMPONENT', req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin Templates
app.post('/api/admin/templates', authenticate, async (req, res) => {
  try {
    const resT = await pool.query('INSERT INTO templates (component_name, name, title, description) VALUES ($1, $2, $3, $4) RETURNING *', [req.body.componentName, req.body.name, req.body.title, req.body.description]);
    await auditService.log(req.user, 'CREATE_TEMPLATE', 'TEMPLATE', req.body.name);
    res.json(resT.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.put('/api/admin/templates/:id', authenticate, async (req, res) => {
  try {
    const resT = await pool.query('UPDATE templates SET component_name=$1, name=$2, title=$3, description=$4 WHERE id=$5 RETURNING *', [req.body.componentName, req.body.name, req.body.title, req.body.description, req.params.id]);
    await auditService.log(req.user, 'UPDATE_TEMPLATE', 'TEMPLATE', req.body.name);
    res.json(resT.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/admin/templates/:id', authenticate, async (req, res) => {
  try {
    await pool.query('DELETE FROM templates WHERE id = $1', [req.params.id]);
    await auditService.log(req.user, 'DELETE_TEMPLATE', 'TEMPLATE', req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin Incident Management
app.post('/api/admin/incidents', authenticate, async (req, res) => {
  try {
    const result = await incidentService.createIncident(req.user, req.body);
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.put('/api/admin/incidents/:id', authenticate, async (req, res) => {
  try {
    const result = await incidentService.updateIncident(req.user, req.params.id, req.body);
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/admin/incidents/:id/resolve', authenticate, async (req, res) => {
  try {
    const result = await incidentService.updateIncident(req.user, req.params.id, { ...req.body, endTime: new Date().toISOString() });
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Static Assets
app.use(express.static(rootPath));
app.get('*', (req, res) => res.sendFile(path.join(rootPath, 'index.html')));

/**
 * STARTUP
 */
const start = async () => {
  try {
    await waitForDb();
    const port = parseInt(process.env.PORT || '3000');
    const server = app.listen(port, () => console.log(`[SERVER] Ready at http://localhost:${port}`));
    const shutdown = () => {
      console.log('[SERVER] Shutting down...');
      server.close(() => { pool.end(); process.exit(0); });
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (err) {
    console.error('[FATAL STARTUP ERROR]', err);
    process.exit(1);
  }
};
start();
