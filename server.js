
import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import * as esbuild from 'esbuild';
import crypto from 'crypto';

// Import Node-specific services
import pool from './lib/db.js';
import { incidentService } from './services/incidentService.js';
import { auditService } from './services/auditService.js';

const app = express();
const rootPath = path.resolve();
const MODE = process.env.MODE || 'NODE';
const IS_HUB = MODE === 'HUB';

/**
 * Migration: Ensures the DB schema is upgraded from Service-based to Region-based.
 */
const migrateDb = async () => {
  if (IS_HUB) return; 
  let client;
  try {
    client = await pool.connect();
    console.log('[DB] Synchronizing schema...');
    
    // Ensure regions table exists first
    await client.query(`
      CREATE TABLE IF NOT EXISTS regions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Check if services table exists (old schema)
    const tableCheck = await client.query("SELECT to_regclass('public.services') as exists");
    const hasServicesTable = tableCheck.rows[0].exists !== null;

    // Check if region_id exists on components
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'components' 
      AND column_name = 'region_id'
    `);
    const hasRegionId = columnCheck.rows.length > 0;

    if (!hasRegionId) {
      console.log("[DB] Migrating: Adding 'region_id' column to components...");
      await client.query('ALTER TABLE components ADD COLUMN region_id UUID REFERENCES regions(id) ON DELETE CASCADE');
    }

    if (hasServicesTable) {
      console.log("[DB] Migrating: Re-mapping components directly to regions...");
      // Link components to the region their parent service belonged to
      await client.query(`
        UPDATE components c 
        SET region_id = s.region_id 
        FROM services s 
        WHERE c.service_id = s.id AND c.region_id IS NULL;
      `);
      
      console.log("[DB] Migrating: Dropping legacy services table...");
      await client.query(`
        ALTER TABLE components DROP COLUMN IF EXISTS service_id;
        DROP TABLE IF EXISTS services CASCADE;
      `);
    }

    console.log("[DB] Schema is up-to-date.");
  } catch (err) {
    console.error('[DB] Migration failed:', err.message);
    // In dev, we log but allow startup; in prod, you might want process.exit(1)
  } finally {
    if (client) client.release();
  }
};

app.use((req, res, next) => {
  const origin = req.headers.origin;
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-ADMIN-SECRET, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') return res.status(204).send();
  next();
});

app.use(express.json());
app.use(cookieParser());

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
      res.status(500).send(`console.error("Transpilation failed");`);
    }
  } else next();
});

if (!IS_HUB) {
  const nodeAuth = (req, res, next) => {
    const secret = req.headers['x-admin-secret'];
    if (secret !== process.env.ADMIN_SECRET) return res.status(401).json({ error: 'Unauthorized' });
    req.user = 'remote-admin'; 
    next();
  };

  app.get('/api/status', async (req, res) => {
    try {
      const regions = await pool.query('SELECT id, name FROM regions');
      const components = await pool.query('SELECT id, region_id as "regionId", name, description, created_at as "createdAt" FROM components');
      const incidents = await pool.query('SELECT id, component_id as "componentId", title, description, severity, start_time as "startTime", end_time as "endTime" FROM incidents ORDER BY start_time DESC');
      res.json({ regions: regions.rows, components: components.rows, incidents: incidents.rows });
    } catch (err) {
      console.error('[API ERROR] /api/status:', err.message);
      res.status(500).json({ error: 'Internal Server Error: ' + err.message });
    }
  });

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

  app.post('/api/admin/incidents', nodeAuth, async (req, res) => {
    try {
      const incident = await incidentService.createIncident(req.user, req.body);
      res.json(incident);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.put('/api/admin/incidents/:id', nodeAuth, async (req, res) => {
    try {
      const incident = await incidentService.updateIncident(req.user, req.params.id, req.body);
      res.json(incident);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.post('/api/admin/incidents/:id/resolve', nodeAuth, async (req, res) => {
    try {
      const incident = await incidentService.resolveIncident(req.user, req.params.id);
      res.json(incident);
    } catch (err) { res.status(500).json({ error: err.message }); }
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

  app.post('/api/admin/components', nodeAuth, async (req, res) => {
    const { regionId, name, description } = req.body;
    const result = await pool.query('INSERT INTO components (region_id, name, description) VALUES ($1, $2, $3) RETURNING id, region_id as "regionId", name, description', [regionId, name, description]);
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
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.delete('/api/admin/subscriptions/by-email', async (req, res) => {
    try {
      await pool.query('DELETE FROM subscriptions WHERE email = $1', [req.body.email]);
      res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
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

if (IS_HUB) {
  const portalSessions = new Map();
  let DASHBOARD_CONFIGS = [];
  try { DASHBOARD_CONFIGS = JSON.parse(process.env.DASHBOARDS || '[]'); } catch (e) {}

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
    } else res.status(401).json({ error: 'Invalid Credentials' });
  });

  app.get('/api/portal/configs', authenticatePortal, (req, res) => res.json(DASHBOARD_CONFIGS));
}

app.use(express.static(rootPath));
app.get('*', (req, res) => res.sendFile(path.join(rootPath, 'index.html')));

const port = parseInt(process.env.PORT || '3000');

// Start process: Migration THEN Server
(async () => {
  try {
    await migrateDb();
    app.listen(port, () => console.log(`[SERVICE] Running on port ${port} (MODE=${MODE})`));
  } catch (err) {
    console.error('[FATAL] Service failed to start:', err);
  }
})();
