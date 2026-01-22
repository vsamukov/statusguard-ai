
import 'dotenv/config';
import express from 'express';
import pg from 'pg';
const { Pool } = pg;
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import * as esbuild from 'esbuild';

const app = express();
const rootPath = path.resolve();

app.use(express.json());

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
          'process.env.API_KEY': JSON.stringify(process.env.API_KEY || 'MISSING_API_KEY')
        }
      });
      res.type('application/javascript');
      res.send(result.code);
    } catch (err) {
      console.error(`[TRANSPILER] Error in ${cleanPath}:`, err);
      res.status(500).send(`console.error("Transpilation failed for ${cleanPath}");`);
    }
  } else {
    next();
  }
});

app.use(express.static(rootPath));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/voximplant_status',
});

/**
 * AUDIT LOGGING HELPER
 */
async function logAudit(username, actionType, targetType, targetName, details = {}) {
  try {
    await pool.query(
      'INSERT INTO audit_logs (username, action_type, target_type, target_name, details) VALUES ($1, $2, $3, $4, $5)',
      [username, actionType, targetType, targetName, JSON.stringify(details)]
    );
  } catch (err) {
    console.error('[AUDIT ERROR]', err);
  }
}

/**
 * DATABASE INITIALIZATION
 */
const initDb = async () => {
  try {
    const client = await pool.connect();
    console.log('[VOXIMPLANT] Connected to PostgreSQL');
    try {
      const schemaFile = path.join(rootPath, 'schema.sql');
      if (fs.existsSync(schemaFile)) {
        await client.query(fs.readFileSync(schemaFile, 'utf8'));
      }

      const adminUsername = process.env.ADMIN_USER || 'admin';
      const adminPassword = process.env.ADMIN_PASS || 'password';
      const hashed = hashPassword(adminPassword);
      
      await client.query(
        'INSERT INTO users (username, password_hash) VALUES ($1, $2) ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash', 
        [adminUsername, hashed]
      );

      const seedFile = path.join(rootPath, 'seed.sql');
      const { rowCount } = await client.query('SELECT 1 FROM regions LIMIT 1');
      if (rowCount === 0 && fs.existsSync(seedFile)) {
        console.log('[VOXIMPLANT] Empty database detected. Seeding initial data...');
        await client.query(fs.readFileSync(seedFile, 'utf8'));
      }
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[VOXIMPLANT] Database initialization failed:', err);
  }
};

/**
 * API ROUTES
 */

// PUBLIC: Status Map
app.get('/api/status', async (req, res) => {
  try {
    const [regions, services, components, incidents] = await Promise.all([
      pool.query('SELECT id, name FROM regions ORDER BY name'),
      pool.query('SELECT id, region_id AS "regionId", name, description FROM services ORDER BY name'),
      pool.query('SELECT id, service_id AS "serviceId", name, description, created_at AS "createdAt" FROM components ORDER BY name'),
      pool.query('SELECT id, component_id AS "componentId", title, description, severity, start_time AS "startTime", end_time AS "endTime" FROM incidents ORDER BY start_time DESC'),
    ]);
    res.json({
      regions: regions.rows,
      services: services.rows,
      components: components.rows,
      incidents: incidents.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AUTH
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (rows.length === 0 || !verifyPassword(password, rows[0].password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, username);
    await logAudit(username, 'LOGIN', 'USER', username);
    res.json({ token, username });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADMIN: Get Full Data
app.get('/api/admin/data', authenticate, async (req, res) => {
  try {
    const [users, auditLogs] = await Promise.all([
      pool.query('SELECT id, username, created_at AS "createdAt" FROM users ORDER BY username'),
      pool.query('SELECT id, username, action_type AS "actionType", target_type AS "targetType", target_name AS "targetName", details, created_at AS "createdAt" FROM audit_logs ORDER BY created_at DESC LIMIT 100'),
    ]);
    res.json({
      users: users.rows,
      auditLogs: auditLogs.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ADMIN: Regions
app.post('/api/admin/regions', authenticate, async (req, res) => {
  const { name } = req.body;
  try {
    const { rows } = await pool.query('INSERT INTO regions (name) VALUES ($1) RETURNING id, name', [name]);
    await logAudit(req.user, 'CREATE_REGION', 'REGION', name);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/regions/:id', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM regions WHERE id = $1 RETURNING name', [req.params.id]);
    if (rows.length > 0) await logAudit(req.user, 'DELETE_REGION', 'REGION', rows[0].name);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ADMIN: Services
app.post('/api/admin/services', authenticate, async (req, res) => {
  const { regionId, name, description } = req.body;
  try {
    const { rows } = await pool.query(
      'INSERT INTO services (region_id, name, description) VALUES ($1, $2, $3) RETURNING id, region_id AS "regionId", name, description', 
      [regionId, name, description]
    );
    await logAudit(req.user, 'CREATE_SERVICE', 'SERVICE', name);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/services/:id', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM services WHERE id = $1 RETURNING name', [req.params.id]);
    if (rows.length > 0) await logAudit(req.user, 'DELETE_SERVICE', 'SERVICE', rows[0].name);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ADMIN: Components
app.post('/api/admin/components', authenticate, async (req, res) => {
  const { serviceId, name, description } = req.body;
  try {
    const { rows } = await pool.query(
      'INSERT INTO components (service_id, name, description) VALUES ($1, $2, $3) RETURNING id, service_id AS "serviceId", name, description, created_at AS "createdAt"', 
      [serviceId, name, description]
    );
    await logAudit(req.user, 'CREATE_COMPONENT', 'COMPONENT', name);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/components/:id', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM components WHERE id = $1 RETURNING name', [req.params.id]);
    if (rows.length > 0) await logAudit(req.user, 'DELETE_COMPONENT', 'COMPONENT', rows[0].name);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ADMIN: Incidents
app.post('/api/admin/incidents', authenticate, async (req, res) => {
  const { componentId, title, description, severity, startTime, endTime } = req.body;
  try {
    const { rows } = await pool.query(
      'INSERT INTO incidents (component_id, title, description, severity, start_time, end_time) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, component_id AS "componentId", title, description, severity, start_time AS "startTime", end_time AS "endTime"', 
      [componentId, title, description, severity, startTime, endTime]
    );
    await logAudit(req.user, 'CREATE_INCIDENT', 'INCIDENT', title);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/admin/incidents/:id', authenticate, async (req, res) => {
  const { title, description, severity, startTime, endTime, componentId } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE incidents SET title=$1, description=$2, severity=$3, start_time=$4, end_time=$5, component_id=$6 WHERE id=$7 RETURNING id, component_id AS "componentId", title, description, severity, start_time AS "startTime", end_time AS "endTime"',
      [title, description, severity, startTime, endTime, componentId, req.params.id]
    );
    await logAudit(req.user, 'UPDATE_INCIDENT', 'INCIDENT', title);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/incidents/:id/resolve', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'UPDATE incidents SET end_time = CURRENT_TIMESTAMP WHERE id = $1 RETURNING title', 
      [req.params.id]
    );
    if (rows.length > 0) await logAudit(req.user, 'RESOLVE_INCIDENT', 'INCIDENT', rows[0].title);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ADMIN: Team
app.post('/api/admin/users', authenticate, async (req, res) => {
  const { username, password } = req.body;
  try {
    const hash = hashPassword(password);
    const { rows } = await pool.query('INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at AS "createdAt"', [username, hash]);
    await logAudit(req.user, 'CREATE_USER', 'USER', username);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: 'Username already exists' }); }
});

app.delete('/api/admin/users/:id', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM users WHERE id = $1 RETURNING username', [req.params.id]);
    if (rows.length > 0) await logAudit(req.user, 'DELETE_USER', 'USER', rows[0].username);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// START
initDb().then(() => {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`[VOXIMPLANT] Server running at http://localhost:${port}`);
  });
});
