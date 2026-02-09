
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
const IS_HUB = process.env.MODE === 'HUB';

app.use(express.json());
app.use(cookieParser());

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
  console.log('[MODE] Status Page Node');

  const nodeAuth = (req, res, next) => {
    const secret = req.headers['x-admin-secret'];
    if (secret !== process.env.ADMIN_SECRET) {
      return res.status(401).json({ error: 'Unauthorized Node Management' });
    }
    req.user = 'remote-admin'; // Hub acts as admin
    next();
  };

  // Public Status Data
  app.get('/api/status', async (req, res) => {
    try {
      const regions = await pool.query('SELECT * FROM regions');
      const services = await pool.query('SELECT * FROM services');
      const components = await pool.query('SELECT * FROM components');
      const incidents = await pool.query('SELECT * FROM incidents ORDER BY start_time DESC');
      res.json({ regions: regions.rows, services: services.rows, components: components.rows, incidents: incidents.rows });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin Data for Hub
  app.get('/api/admin/data', nodeAuth, async (req, res) => {
    try {
      const templates = await pool.query('SELECT * FROM templates');
      const auditLogs = await pool.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 50');
      const settings = await pool.query('SELECT * FROM notification_settings');
      res.json({ templates: templates.rows, auditLogs: auditLogs.rows, notificationSettings: settings.rows });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Incident Management
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

  // Infrastructure Management
  app.post('/api/admin/regions', nodeAuth, async (req, res) => {
    const result = await pool.query('INSERT INTO regions (name) VALUES ($1) RETURNING *', [req.body.name]);
    await auditService.log(req.user, 'CREATE_REGION', 'REGION', req.body.name);
    res.json(result.rows[0]);
  });

  app.delete('/api/admin/regions/:id', nodeAuth, async (req, res) => {
    const region = await pool.query('SELECT name FROM regions WHERE id = $1', [req.params.id]);
    await pool.query('DELETE FROM regions WHERE id = $1', [req.params.id]);
    await auditService.log(req.user, 'DELETE_REGION', 'REGION', region.rows[0]?.name);
    res.json({ success: true });
  });

  // (Additional endpoints for services, components, etc. would go here following the same pattern)
}

/**
 * ---------------------------------------------------------
 * HUB MODE: Management Portal Logic (No Database)
 * ---------------------------------------------------------
 */
if (IS_HUB) {
  console.log('[MODE] Portal Hub');
  const portalSessions = new Map();
  const DASHBOARD_CONFIGS = JSON.parse(process.env.DASHBOARDS || '[]');

  const authenticatePortal = (req, res, next) => {
    const token = req.cookies.session_id || req.headers.authorization?.split(' ')[1];
    if (!portalSessions.has(token)) return res.status(401).json({ error: 'Unauthorized' });
    next();
  };

  app.post('/api/portal/auth', (req, res) => {
    const { username, password } = req.body;
    if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
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
app.listen(port, () => console.log(`[${process.env.MODE}] listening on port ${port}`));
