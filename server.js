
import 'dotenv/config';
import express from 'express';
import pg from 'pg';
const { Pool } = pg;
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import * as esbuild from 'esbuild';
import SubscriptionService from './services/subscriptionService.js';

const app = express();
const rootPath = path.resolve();

app.use(express.json());

// Initialize Subscription Service (now uses SMTP via env)
const notificationService = new SubscriptionService();

/**
 * SECURITY HELPERS
 */
const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
};

const verifyPassword = (password, storedValue) => {
  try {
    if (!storedValue || !storedValue.includes(':')) return false;
    const [salt, hash] = storedValue.split(':');
    const derivedHash = crypto.scryptSync(password, salt, 64).toString('hex');
    return derivedHash === hash;
  } catch (e) {
    return false;
  }
};

/**
 * AUTHENTICATION MIDDLEWARE
 */
const sessions = new Map();

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.split(' ')[1];
  const username = sessions.get(token);
  if (!username) {
    return res.status(401).json({ error: 'Session expired' });
  }
  req.user = username;
  next();
};

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/voximplant_status',
});

/**
 * NOTIFICATION ORCHESTRATION
 */
async function notifySubscribers(incidentId, type) {
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
    const fromEmail = process.env.SMTP_FROM || 'status@voximplant.com';

    await notificationService.sendBroadcast({
      fromEmail,
      subject,
      recipients,
      html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 12px; padding: 30px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #4f46e5; margin-bottom: 5px;">Status Update</h2>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        </div>
        <p style="white-space: pre-wrap;">${messageHtml}</p>
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #999; text-align: center;">
          This is an automated message. To unsubscribe, visit our status page.
        </div>
      </div>`
    });

  } catch (err) {
    console.error('[NOTIFY ORCHESTRATOR ERROR]', err);
  }
}

/**
 * API ROUTES
 */

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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/subscriptions', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  try {
    await pool.query('INSERT INTO subscriptions (email) VALUES ($1) ON CONFLICT (email) DO NOTHING', [email]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/subscriptions/unsubscribe', async (req, res) => {
  const { email } = req.body;
  try {
    const { rowCount } = await pool.query('DELETE FROM subscriptions WHERE email = $1', [email]);
    if (rowCount === 0) return res.status(404).json({ error: 'Email not found' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (rows.length === 0 || !verifyPassword(password, rows[0].password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, username);
    res.json({ token, username });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/data', authenticate, async (req, res) => {
  try {
    const [users, auditLogs] = await Promise.all([
      pool.query('SELECT id, username, created_at AS "createdAt" FROM users ORDER BY username'),
      pool.query('SELECT id, username, action_type AS "actionType", target_type AS "targetType", target_name AS "targetName", details, created_at AS "createdAt" FROM audit_logs ORDER BY created_at DESC LIMIT 100'),
    ]);
    res.json({ users: users.rows, auditLogs: auditLogs.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ADMIN: Paginated & Searchable Subscriptions (Handles thousands of records)
app.get('/api/admin/subscribers', authenticate, async (req, res) => {
  let page = parseInt(req.query.page) || 1;
  let limit = parseInt(req.query.limit) || 20;
  let search = req.query.search || '';
  const offset = (page - 1) * limit;
  
  const sqlSearch = search.replace(/\*/g, '%');
  
  try {
    let queryStr = 'SELECT id, email, created_at AS "createdAt" FROM subscriptions';
    let countStr = 'SELECT COUNT(*) FROM subscriptions';
    const params = [];

    if (search) {
      const condition = ' WHERE email ILIKE $1';
      queryStr += condition;
      countStr += condition;
      params.push(sqlSearch.includes('%') ? sqlSearch : `%${sqlSearch}%`);
    }

    queryStr += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    
    const [dataRes, countRes] = await Promise.all([
      pool.query(queryStr, [...params, limit, offset]),
      pool.query(countStr, params)
    ]);

    res.json({
      data: dataRes.rows,
      total: parseInt(countRes.rows[0].count),
      page,
      limit
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/subscriptions', authenticate, async (req, res) => {
  const { email } = req.body;
  try {
    const { rows } = await pool.query('INSERT INTO subscriptions (email) VALUES ($1) RETURNING id, email, created_at AS "createdAt"', [email]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: 'Email already exists' }); }
});

app.put('/api/admin/subscriptions/:id', authenticate, async (req, res) => {
  const { email } = req.body;
  try {
    const { rows } = await pool.query('UPDATE subscriptions SET email = $1 WHERE id = $2 RETURNING id, email, created_at AS "createdAt"', [email, req.params.id]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/subscriptions/:id', authenticate, async (req, res) => {
  try {
    await pool.query('DELETE FROM subscriptions WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/notification-settings', authenticate, async (req, res) => {
  const { incidentNewTemplate, incidentResolvedTemplate } = req.body;
  try {
    await pool.query('INSERT INTO notification_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', ['incident_new_template', incidentNewTemplate]);
    await pool.query('INSERT INTO notification_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', ['incident_resolved_template', incidentResolvedTemplate]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/templates', authenticate, async (req, res) => {
  const { componentName, name, title, description } = req.body;
  try {
    const { rows } = await pool.query(
      'INSERT INTO templates (component_name, name, title, description) VALUES ($1, $2, $3, $4) RETURNING id, component_name AS "componentName", name, title, description', 
      [componentName, name, title, description]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/admin/templates/:id', authenticate, async (req, res) => {
  const { name, title, description, componentName } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE templates SET name=$1, title=$2, description=$3, component_name=$4 WHERE id=$5 RETURNING id, component_name AS "componentName", name, title, description',
      [name, title, description, componentName, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/templates/:id', authenticate, async (req, res) => {
  try {
    await pool.query('DELETE FROM templates WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/regions', authenticate, async (req, res) => {
  const { name } = req.body;
  try {
    const { rows } = await pool.query('INSERT INTO regions (name) VALUES ($1) RETURNING id, name', [name]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/regions/:id', authenticate, async (req, res) => {
  try {
    await pool.query('DELETE FROM regions WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/services', authenticate, async (req, res) => {
  const { regionId, name, description } = req.body;
  try {
    const { rows } = await pool.query(
      'INSERT INTO services (region_id, name, description) VALUES ($1, $2, $3) RETURNING id, region_id AS "regionId", name, description', 
      [regionId, name, description]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/services/:id', authenticate, async (req, res) => {
  try {
    await pool.query('DELETE FROM services WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/components', authenticate, async (req, res) => {
  const { serviceId, name, description } = req.body;
  try {
    const { rows } = await pool.query(
      'INSERT INTO components (service_id, name, description) VALUES ($1, $2, $3) RETURNING id, service_id AS "serviceId", name, description, created_at AS "createdAt"', 
      [serviceId, name, description]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/components/:id', authenticate, async (req, res) => {
  try {
    await pool.query('DELETE FROM components WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/incidents', authenticate, async (req, res) => {
  const { componentId, title, description, severity, startTime, endTime } = req.body;
  try {
    const { rows } = await pool.query(
      'INSERT INTO incidents (component_id, title, description, severity, start_time, end_time) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id', 
      [componentId, title, description, severity, startTime, endTime]
    );
    notifySubscribers(rows[0].id, 'NEW');
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/admin/incidents/:id', authenticate, async (req, res) => {
  const { title, description, severity, startTime, endTime, componentId } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE incidents SET title=$1, description=$2, severity=$3, start_time=$4, end_time=$5, component_id=$6 WHERE id=$7 RETURNING id',
      [title, description, severity, startTime, endTime, componentId, req.params.id]
    );
    if (endTime) notifySubscribers(rows[0].id, 'RESOLVED');
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/incidents/:id/resolve', authenticate, async (req, res) => {
  try {
    await pool.query('UPDATE incidents SET end_time = CURRENT_TIMESTAMP WHERE id = $1', [req.params.id]);
    notifySubscribers(req.params.id, 'RESOLVED');
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/users', authenticate, async (req, res) => {
  const { username, password } = req.body;
  try {
    const hash = hashPassword(password);
    const { rows } = await pool.query('INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username', [username, hash]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: 'Username already exists' }); }
});

app.delete('/api/admin/users/:id', authenticate, async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/**
 * STATIC SERVING & SPA SUPPORT
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
        format: 'esm', target: 'es2020', sourcemap: 'inline',
        define: { 'process.env.API_KEY': JSON.stringify(process.env.API_KEY || '') }
      });
      res.type('application/javascript').send(result.code);
    } catch (err) { res.status(500).send(`console.error("Transpilation failed for ${cleanPath}");`); }
  } else { next(); }
});

app.use(express.static(rootPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(rootPath, 'index.html'));
});

const initDb = async () => {
  try {
    const client = await pool.connect();
    console.log('[VOXIMPLANT] PostgreSQL Connected');
    try {
      const schemaFile = path.join(rootPath, 'schema.sql');
      if (fs.existsSync(schemaFile)) {
        await client.query(fs.readFileSync(schemaFile, 'utf8'));
      }
      const adminUsername = process.env.ADMIN_USER || 'admin';
      const adminPassword = process.env.ADMIN_PASS || 'password';
      const hashed = hashPassword(adminPassword);
      await client.query('INSERT INTO users (username, password_hash) VALUES ($1, $2) ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash', [adminUsername, hashed]);
    } finally { client.release(); }
  } catch (err) { console.error('[VOXIMPLANT] DB Init Failed:', err); }
};

initDb().then(() => {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`[VOXIMPLANT] Server running at http://localhost:${port}`));
});
