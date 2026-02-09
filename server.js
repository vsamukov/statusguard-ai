
import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import * as esbuild from 'esbuild';
import crypto from 'crypto';

// Import Node-specific services (only used if MODE=NODE)
import pool from './lib/db.js';
import { incidentService } from './services/incidentService.js';
import { auditService } from './services/auditService.js';

const app = express();
const rootPath = path.resolve();
const MODE = process.env.MODE || 'NODE';
const IS_HUB = MODE === 'HUB';

app.use(express.json());
app.use(cookieParser());

/**
 * CORS MIDDLEWARE (Critical for Hub Mode)
 */
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*'); // In production, restrict this to your Hub domain
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-ADMIN-SECRET, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

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
        define: { 
          'process.env.API_KEY': JSON.stringify(process.env.API_KEY || ''),
          'process.env.IS_HUB': JSON.stringify(IS_HUB)
        }
      });
      res.type('application/javascript').send(result.code);
    } catch (err) {
      console.error(`Transpilation failed:`, err);
      res.status(500).send(`console.error("Transpilation failed");`);
    }
  } else {
    next();
  }
});

/**
 * ---------------------------------------------------------
 * NODE MODE: Status Page Logic (Requires Database)
 * ---------------------------------------------------------
 */
if (!IS_HUB) {
  console.log('[SYSTEM] Starting in NODE mode (Status Page)');

  const nodeAuth = (req, res, next) => {
    const secret = req.headers['x-admin-secret'];
    if (secret !== process.env.ADMIN_SECRET) {
      return res.status(401).json({ error: 'Unauthorized Node Management' });
    }
    req.user = 'remote-admin'; 
    next();
  };

  // Public Status Data
  app.get('/api/status', async (req, res) => {
    try {
      const regions = await pool.query('SELECT id, name FROM regions');
      const services = await pool.query('SELECT id, region_id as "regionId", name, description FROM services');
      const components = await pool.query('SELECT id, service_id as "serviceId", name, description, created_at as "createdAt" FROM components');
      const incidents = await pool.query('SELECT id, component_id as "componentId", title, description, severity, start_time as "startTime", end_time as "endTime" FROM incidents ORDER BY start_time DESC');
      
      res.json({ 
        regions: regions.rows, 
        services: services.rows, 
        components: components.rows, 
        incidents: incidents.rows 
      });
    } catch (err) {
      console.error('DB Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Admin Data for Hub
  app.get('/api/admin/data', nodeAuth, async (req, res) => {
    try {
      const templates = await pool.query('SELECT id, component_name as "componentName", name, title, description FROM templates');
      const auditLogs = await pool.query('SELECT id, username, action_type as "actionType", target_type as "targetType", target_name as "targetName", details, created_at as "createdAt" FROM audit_logs ORDER BY created_at DESC LIMIT 50');
      
      const settingsRows = await pool.query('SELECT key, value FROM notification_settings');
      const notificationSettings = {
        incidentNewTemplate: settingsRows.rows.find(r => r.key === 'incident_new_template')?.value || '',
        incidentResolvedTemplate: settingsRows.rows.find(r => r.key === 'incident_resolved_template')?.value || ''
      };

      res.json({ templates: templates.rows, auditLogs: auditLogs.rows, notificationSettings });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Subscriber Management with Pagination
  app.get('/api/admin/subscribers', nodeAuth, async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search ? `%${req.query.search}%` : '%';

    try {
      const countRes = await pool.query('SELECT count(*) FROM subscriptions WHERE email LIKE $1', [search]);
      const itemsRes = await pool.query('SELECT id, email, created_at as "createdAt" FROM subscriptions WHERE email LIKE $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3', [search, limit, offset]);
      res.json({ total: parseInt(countRes.rows[0].count), items: itemsRes.rows });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // (rest of the endpoints remain same but ensure nodeAuth is used)
  app.post('/api/admin/incidents', nodeAuth, async (req, res) => {
    try {
      const incident = await incidentService.createIncident(req.user, req.body);
      res.json(incident);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/admin/incidents/:id', nodeAuth, async (req, res) => {
    try {
      const incident = await incidentService.updateIncident(req.user, req.params.id, req.body);
      res.json(incident);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/regions', nodeAuth, async (req, res) => {
    const result = await pool.query('INSERT INTO regions (name) VALUES ($1) RETURNING id, name', [req.body.name]);
    await auditService.log(req.user, 'CREATE_REGION', 'REGION', req.body.name);
    res.json(result.rows[0]);
  });

  app.delete('/api/admin/regions/:id', nodeAuth, async (req, res) => {
    const region = await pool.query('SELECT name FROM regions WHERE id = $1', [req.params.id]);
    await pool.query('DELETE FROM regions WHERE id = $1', [req.params.id]);
    await auditService.log(req.user, 'DELETE_REGION', 'REGION', region.rows[0]?.name);
    res.json({ success: true });
  });

  app.post('/api/admin/services', nodeAuth, async (req, res) => {
    const { regionId, name, description } = req.body;
    const result = await pool.query('INSERT INTO services (region_id, name, description) VALUES ($1, $2, $3) RETURNING id, region_id as "regionId", name, description', [regionId, name, description]);
    await auditService.log(req.user, 'CREATE_SERVICE', 'SERVICE', name);
    res.json(result.rows[0]);
  });

  app.delete('/api/admin/services/:id', nodeAuth, async (req, res) => {
    const service = await pool.query('SELECT name FROM services WHERE id = $1', [req.params.id]);
    await pool.query('DELETE FROM services WHERE id = $1', [req.params.id]);
    await auditService.log(req.user, 'DELETE_SERVICE', 'SERVICE', service.rows[0]?.name);
    res.json({ success: true });
  });

  app.post('/api/admin/components', nodeAuth, async (req, res) => {
    const { serviceId, name, description } = req.body;
    const result = await pool.query('INSERT INTO components (service_id, name, description) VALUES ($1, $2, $3) RETURNING id, service_id as "serviceId", name, description', [serviceId, name, description]);
    await auditService.log(req.user, 'CREATE_COMPONENT', 'COMPONENT', name);
    res.json(result.rows[0]);
  });

  app.delete('/api/admin/components/:id', nodeAuth, async (req, res) => {
    const comp = await pool.query('SELECT name FROM components WHERE id = $1', [req.params.id]);
    await pool.query('DELETE FROM components WHERE id = $1', [req.params.id]);
    await auditService.log(req.user, 'DELETE_COMPONENT', 'COMPONENT', comp.rows[0]?.name);
    res.json({ success: true });
  });

  app.post('/api/admin/subscriptions', async (req, res) => {
    try {
      const result = await pool.query('INSERT INTO subscriptions (email) VALUES ($1) ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email RETURNING id, email, created_at as "createdAt"', [req.body.email]);
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/admin/subscriptions/by-email', async (req, res) => {
    try {
      await pool.query('DELETE FROM subscriptions WHERE email = $1', [req.body.email]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/admin/subscriptions/:id', nodeAuth, async (req, res) => {
    await pool.query('DELETE FROM subscriptions WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  });

  app.post('/api/admin/notification-settings', nodeAuth, async (req, res) => {
    const { incidentNewTemplate, incidentResolvedTemplate } = req.body;
    await pool.query('INSERT INTO notification_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', ['incident_new_template', incidentNewTemplate]);
    await pool.query('INSERT INTO notification_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', ['incident_resolved_template', incidentResolvedTemplate]);
    res.json({ success: true });
  });

  app.post('/api/admin/templates', nodeAuth, async (req, res) => {
    const { componentName, name, title, description } = req.body;
    const resT = await pool.query('INSERT INTO templates (component_name, name, title, description) VALUES ($1, $2, $3, $4) RETURNING id, component_name as "componentName", name, title, description', [componentName, name, title, description]);
    res.json(resT.rows[0]);
  });

  app.put('/api/admin/templates/:id', nodeAuth, async (req, res) => {
    const { componentName, name, title, description } = req.body;
    const resT = await pool.query('UPDATE templates SET component_name=$1, name=$2, title=$3, description=$4 WHERE id=$5 RETURNING id, component_name as "componentName", name, title, description', [componentName, name, title, description, req.params.id]);
    res.json(resT.rows[0]);
  });

  app.delete('/api/admin/templates/:id', nodeAuth, async (req, res) => {
    await pool.query('DELETE FROM templates WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  });
}

/**
 * ---------------------------------------------------------
 * HUB MODE: Management Portal Logic (No Database)
 * ---------------------------------------------------------
 */
if (IS_HUB) {
  console.log('[SYSTEM] Starting in HUB mode (Management Portal)');
  const portalSessions = new Map();
  
  let DASHBOARD_CONFIGS = [];
  try {
    const rawDashboards = process.env.DASHBOARDS || '[]';
    DASHBOARD_CONFIGS = JSON.parse(rawDashboards);
  } catch (e) {
    console.error('[CRITICAL] Failed to parse DASHBOARDS environment variable.');
  }

  const authenticatePortal = (req, res, next) => {
    const token = req.cookies.session_id || req.headers.authorization?.split(' ')[1];
    if (!portalSessions.has(token)) return res.status(401).json({ error: 'Unauthorized' });
    next();
  };

  app.post('/api/portal/auth', (req, res) => {
    const { username, password } = req.body;
    if (username === process.env.ADMIN_USER && username && password === process.env.ADMIN_PASS) {
      const token = crypto.randomBytes(32).toString('hex');
      portalSessions.set(token, username);
      res.cookie('session_id', token, { httpOnly: true });
      res.json({ token, username });
    } else {
      res.status(401).json({ error: 'Invalid Hub Credentials' });
    }
  });

  app.get('/api/portal/configs', authenticatePortal, (req, res) => res.json(DASHBOARD_CONFIGS));
}

// Global Static Assets
app.use(express.static(rootPath));
app.get('*', (req, res) => res.sendFile(path.join(rootPath, 'index.html')));

const port = parseInt(process.env.PORT || '3000');
app.listen(port, () => console.log(`[SERVICE] Running on port ${port} as ${MODE}`));
