
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
 * TRANSPILATION MIDDLEWARE (Required for .tsx support in this environment)
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
    res.cookie('session_id', token, { httpOnly: true, secure: false }); // secure false for local dev/simulated env
    res.json({ token, username });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin Data
app.get('/api/admin/data', authenticate, async (req, res) => {
  try {
    const [users, auditLogs] = await Promise.all([
      pool.query('SELECT id, username, created_at AS "createdAt" FROM users ORDER BY username'),
      pool.query('SELECT id, username, action_type AS "actionType", target_type AS "targetType", target_name AS "targetName", details, created_at AS "createdAt" FROM audit_logs ORDER BY created_at DESC LIMIT 100'),
    ]);
    res.json({ users: users.rows, auditLogs: auditLogs.rows });
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
    const result = await incidentService.updateIncident(req.user, req.params.id, { 
       ...req.body,
       endTime: new Date().toISOString()
    });
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
    const port = process.env.PORT || 3000;
    const server = app.listen(port, () => console.log(`[SERVER] Ready at http://localhost:${port}`));
    
    const shutdown = () => {
      console.log('[SERVER] Shutting down...');
      server.close(() => {
        pool.end();
        process.exit(0);
      });
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (err) {
    console.error('[FATAL STARTUP ERROR]', err);
    process.exit(1);
  }
};

start();
