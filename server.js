
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

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString: connectionString || 'postgresql://postgres:postgres@localhost:5432/voximplant_status',
});

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
        console.log('[VOXIMPLANT] Seeding initial data...');
        await client.query(fs.readFileSync(seedFile, 'utf8'));
      }
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[VOXIMPLANT] Database Init Error:', err);
  }
};

initDb();

const sessions = new Map();

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  const token = authHeader.split(' ')[1];
  const masterToken = process.env.ADMIN_TOKEN || 'voximplant-status-admin-token';
  
  if (sessions.has(token)) {
    req.username = sessions.get(token);
    return next();
  } else if (token === masterToken) {
    req.username = process.env.ADMIN_USER || 'admin';
    return next();
  }
  res.status(401).json({ error: 'Unauthorized' });
};

/**
 * AUDIT LOGGING HELPER
 */
const auditLog = async (username, actionType, targetType, targetName, details) => {
  try {
    // Note: Do not JSON.stringify here, pg driver handles objects for JSONB columns correctly.
    await pool.query(
      'INSERT INTO audit_logs (username, action_type, target_type, target_name, details) VALUES ($1, $2, $3, $4, $5)',
      [username, actionType, targetType, targetName, details || null]
    );
  } catch (err) {
    console.error('[AUDIT] Failed to log action to database:', err);
  }
};

/**
 * API ROUTES
 */
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT password_hash FROM users WHERE username = $1', [username]);
    if (result.rowCount === 0) return res.status(401).json({ error: 'Invalid credentials' });

    if (verifyPassword(password, result.rows[0].password_hash)) {
      const token = crypto.randomBytes(32).toString('hex');
      sessions.set(token, username);
      res.json({ token, username });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/status', async (req, res) => {
  try {
    const [regions, services, componentsRes, incidents] = await Promise.all([
      pool.query('SELECT id, name FROM regions ORDER BY name'),
      pool.query('SELECT id, region_id AS "regionId", name, description FROM services ORDER BY name'),
      pool.query('SELECT id, service_id AS "serviceId", name, description, created_at AS "createdAt" FROM components ORDER BY name'),
      pool.query(`SELECT id, component_id AS "componentId", title, description, severity, start_time AS "startTime", end_time AS "endTime" FROM incidents WHERE end_time IS NULL OR start_time > NOW() - INTERVAL '90 days' ORDER BY start_time DESC`)
    ]);

    res.json({ 
      regions: regions.rows, 
      services: services.rows, 
      components: componentsRes.rows,
      incidents: incidents.rows 
    });
  } catch (err) {
    res.status(500).json({ error: 'Data fetch failed' });
  }
});

app.get('/api/admin/data', authenticate, async (req, res) => {
  try {
    const [users, auditLogs] = await Promise.all([
      pool.query('SELECT id, username, created_at AS "createdAt" FROM users ORDER BY created_at DESC'),
      pool.query('SELECT id, username, action_type AS "actionType", target_type AS "targetType", target_name AS "targetName", details, created_at AS "createdAt" FROM audit_logs ORDER BY created_at DESC LIMIT 100')
    ]);
    res.json({ users: users.rows, auditLogs: auditLogs.rows });
  } catch (err) {
    res.status(500).json({ error: 'Admin data fetch failed' });
  }
});

app.post('/api/admin/incidents', authenticate, async (req, res) => {
  const { componentId, title, internalDesc, severity, startTime } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO incidents (component_id, title, description, severity, start_time) VALUES ($1::uuid, $2, $3, $4, $5) RETURNING id, component_id AS "componentId", title, description, severity, start_time AS "startTime", end_time AS "endTime"', 
      [componentId, title, internalDesc, severity, startTime || new Date().toISOString()]
    );
    await auditLog(req.username, 'REPORT_INCIDENT', 'INCIDENT', title, { severity, componentId });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to report incident' });
  }
});

app.put('/api/admin/incidents/:id', authenticate, async (req, res) => {
  const { componentId, title, description, severity, startTime, endTime } = req.body;
  try {
    const prevRes = await pool.query('SELECT * FROM incidents WHERE id = $1::uuid', [req.params.id]);
    if (prevRes.rowCount === 0) return res.status(404).json({ error: 'Incident not found' });
    const prev = prevRes.rows[0];

    const result = await pool.query(
      `UPDATE incidents 
       SET component_id = $1::uuid, title = $2, description = $3, severity = $4, start_time = $5, end_time = $6 
       WHERE id = $7::uuid 
       RETURNING id, component_id AS "componentId", title, description, severity, start_time AS "startTime", end_time AS "endTime"`,
      [componentId, title, description, severity, startTime, endTime, req.params.id]
    );
    
    await auditLog(req.username, 'UPDATE_INCIDENT', 'INCIDENT', title, {
      previous: {
        componentId: prev.component_id,
        severity: prev.severity,
        startTime: prev.start_time,
        endTime: prev.end_time
      },
      updated: {
        componentId,
        severity,
        startTime,
        endTime
      }
    });

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Update failed' });
  }
});

app.post('/api/admin/incidents/:id/resolve', authenticate, async (req, res) => {
  try {
    const target = await pool.query('SELECT title FROM incidents WHERE id = $1::uuid', [req.params.id]);
    if (target.rowCount === 0) return res.status(404).json({ error: 'Incident not found' });
    
    const result = await pool.query('UPDATE incidents SET end_time = CURRENT_TIMESTAMP WHERE id = $1::uuid RETURNING id, component_id AS "componentId", title, description, severity, start_time AS "startTime", end_time AS "endTime"', [req.params.id]);
    
    if (result.rowCount === 0) return res.status(404).json({ error: 'Incident resolution failed' });

    await auditLog(req.username, 'RESOLVE_INCIDENT', 'INCIDENT', target.rows[0].title);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Resolution failed' });
  }
});

app.post('/api/admin/regions', authenticate, async (req, res) => {
  try {
    const result = await pool.query('INSERT INTO regions (name) VALUES ($1) RETURNING *', [req.body.name]);
    await auditLog(req.username, 'CREATE_REGION', 'REGION', req.body.name);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create region' });
  }
});

app.delete('/api/admin/regions/:id', authenticate, async (req, res) => {
  try {
    const target = await pool.query('SELECT name FROM regions WHERE id = $1::uuid', [req.params.id]);
    await pool.query('DELETE FROM regions WHERE id = $1::uuid', [req.params.id]);
    if (target.rowCount > 0) await auditLog(req.username, 'DELETE_REGION', 'REGION', target.rows[0].name);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete region' });
  }
});

app.post('/api/admin/services', authenticate, async (req, res) => {
  const { regionId, name, description } = req.body;
  try {
    const result = await pool.query('INSERT INTO services (region_id, name, description) VALUES ($1::uuid, $2, $3) RETURNING id, region_id AS "regionId", name, description', [regionId, name, description]);
    await auditLog(req.username, 'CREATE_SERVICE', 'SERVICE', name);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create service' });
  }
});

app.delete('/api/admin/services/:id', authenticate, async (req, res) => {
  try {
    const target = await pool.query('SELECT name FROM services WHERE id = $1::uuid', [req.params.id]);
    await pool.query('DELETE FROM services WHERE id = $1::uuid', [req.params.id]);
    if (target.rowCount > 0) await auditLog(req.username, 'DELETE_SERVICE', 'SERVICE', target.rows[0].name);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete service' });
  }
});

app.post('/api/admin/components', authenticate, async (req, res) => {
  const { serviceId, name, description } = req.body;
  try {
    const result = await pool.query('INSERT INTO components (service_id, name, description) VALUES ($1::uuid, $2, $3) RETURNING id, service_id AS "serviceId", name, description, created_at AS "createdAt"', [serviceId, name, description]);
    await auditLog(req.username, 'CREATE_COMPONENT', 'COMPONENT', name);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create component' });
  }
});

app.delete('/api/admin/components/:id', authenticate, async (req, res) => {
  try {
    const target = await pool.query('SELECT name FROM components WHERE id = $1::uuid', [req.params.id]);
    await pool.query('DELETE FROM components WHERE id = $1::uuid', [req.params.id]);
    if (target.rowCount > 0) await auditLog(req.username, 'DELETE_COMPONENT', 'COMPONENT', target.rows[0].name);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete component' });
  }
});

app.post('/api/admin/users', authenticate, async (req, res) => {
  const { username, password } = req.body;
  const hashed = hashPassword(password);
  try {
    const result = await pool.query('INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at AS "createdAt"', [username, hashed]);
    await auditLog(req.username, 'CREATE_USER', 'USER', username);
    res.json(result.rows[0]);
  } catch (err) { res.status(400).json({ error: 'User already exists' }); }
});

app.delete('/api/admin/users/:id', authenticate, async (req, res) => {
  try {
    const user = await pool.query('SELECT username FROM users WHERE id = $1::uuid', [req.params.id]);
    if (user.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    await pool.query('DELETE FROM users WHERE id = $1::uuid', [req.params.id]);
    await auditLog(req.username, 'DELETE_USER', 'USER', user.rows[0].username);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/') && !req.path.includes('.')) {
    return res.sendFile(path.join(rootPath, 'index.html'));
  }
  res.status(404).send('Not Found');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[VOXIMPLANT] Online at http://localhost:${PORT}`));
