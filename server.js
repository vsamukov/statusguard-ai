
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
 * Serves .ts and .tsx files to the browser by transpiling them on the fly.
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

      // Migrations for existing DBs
      await client.query(`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
            CREATE TABLE audit_logs (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              username TEXT NOT NULL,
              action_type TEXT NOT NULL,
              target_type TEXT NOT NULL,
              target_name TEXT,
              details JSONB,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
          END IF;
        END $$;
      `);

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

// Map tokens to usernames for simple session management
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

const auditLog = async (username, actionType, targetType, targetName, details) => {
  try {
    await pool.query(
      'INSERT INTO audit_logs (username, action_type, target_type, target_name, details) VALUES ($1, $2, $3, $4, $5)',
      [username, actionType, targetType, targetName, details ? JSON.stringify(details) : null]
    );
  } catch (err) {
    console.error('[AUDIT] Failed to log action:', err);
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
      components: componentsRes.rows.map(c => ({ ...c, sla90: 100 })),
      incidents: incidents.rows 
    });
  } catch (err) {
    res.status(500).json({ error: 'Data fetch failed' });
  }
});

// Admin Core
app.get('/api/admin/data', authenticate, async (req, res) => {
  const [users, auditLogs] = await Promise.all([
    pool.query('SELECT id, username, created_at AS "createdAt" FROM users ORDER BY created_at DESC'),
    pool.query('SELECT id, username, action_type AS "actionType", target_type AS "targetType", target_name AS "targetName", details, created_at AS "createdAt" FROM audit_logs ORDER BY created_at DESC LIMIT 100')
  ]);
  res.json({ users: users.rows, auditLogs: auditLogs.rows });
});

// User Management
app.post('/api/admin/users', authenticate, async (req, res) => {
  const { username, password } = req.body;
  const hashed = hashPassword(password);
  try {
    const result = await pool.query('INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at AS "createdAt"', [username, hashed]);
    await auditLog(req.username, 'CREATE_USER', 'USER', username);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: 'User already exists' });
  }
});

app.delete('/api/admin/users/:id', authenticate, async (req, res) => {
  const user = await pool.query('SELECT username FROM users WHERE id = $1', [req.params.id]);
  if (user.rowCount === 0) return res.status(404).json({ error: 'Not found' });
  if (user.rows[0].username === req.username) return res.status(400).json({ error: 'Cannot delete self' });

  await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
  await auditLog(req.username, 'DELETE_USER', 'USER', user.rows[0].username);
  res.json({ success: true });
});

// Infrastructure Admin
app.post('/api/admin/regions', authenticate, async (req, res) => {
  const result = await pool.query('INSERT INTO regions (name) VALUES ($1) RETURNING *', [req.body.name]);
  await auditLog(req.username, 'CREATE_REGION', 'REGION', req.body.name);
  res.json(result.rows[0]);
});

app.delete('/api/admin/regions/:id', authenticate, async (req, res) => {
  const target = await pool.query('SELECT name FROM regions WHERE id = $1', [req.params.id]);
  await pool.query('DELETE FROM regions WHERE id = $1', [req.params.id]);
  if (target.rowCount > 0) await auditLog(req.username, 'DELETE_REGION', 'REGION', target.rows[0].name);
  res.json({ success: true });
});

app.post('/api/admin/services', authenticate, async (req, res) => {
  const { regionId, name, description } = req.body;
  const result = await pool.query('INSERT INTO services (region_id, name, description) VALUES ($1, $2, $3) RETURNING id, region_id AS "regionId", name, description', [regionId, name, description]);
  await auditLog(req.username, 'CREATE_SERVICE', 'SERVICE', name);
  res.json(result.rows[0]);
});

app.delete('/api/admin/services/:id', authenticate, async (req, res) => {
  const target = await pool.query('SELECT name FROM services WHERE id = $1', [req.params.id]);
  await pool.query('DELETE FROM services WHERE id = $1', [req.params.id]);
  if (target.rowCount > 0) await auditLog(req.username, 'DELETE_SERVICE', 'SERVICE', target.rows[0].name);
  res.json({ success: true });
});

app.post('/api/admin/components', authenticate, async (req, res) => {
  const { serviceId, name, description } = req.body;
  const result = await pool.query('INSERT INTO components (service_id, name, description) VALUES ($1, $2, $3) RETURNING id, service_id AS "serviceId", name, description, created_at AS "createdAt"', [serviceId, name, description]);
  await auditLog(req.username, 'CREATE_COMPONENT', 'COMPONENT', name);
  res.json(result.rows[0]);
});

app.delete('/api/admin/components/:id', authenticate, async (req, res) => {
  const target = await pool.query('SELECT name FROM components WHERE id = $1', [req.params.id]);
  await pool.query('DELETE FROM components WHERE id = $1', [req.params.id]);
  if (target.rowCount > 0) await auditLog(req.username, 'DELETE_COMPONENT', 'COMPONENT', target.rows[0].name);
  res.json({ success: true });
});

app.post('/api/admin/incidents', authenticate, async (req, res) => {
  const { componentId, title, internalDesc, severity } = req.body;
  const result = await pool.query('INSERT INTO incidents (component_id, title, description, severity) VALUES ($1, $2, $3, $4) RETURNING id, component_id AS "componentId", title, description, severity, start_time AS "startTime", end_time AS "endTime"', [componentId, title, internalDesc, severity]);
  await auditLog(req.username, 'REPORT_INCIDENT', 'INCIDENT', title, { severity });
  res.json(result.rows[0]);
});

app.post('/api/admin/incidents/:id/resolve', authenticate, async (req, res) => {
  const target = await pool.query('SELECT title FROM incidents WHERE id = $1', [req.params.id]);
  const result = await pool.query('UPDATE incidents SET end_time = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id, component_id AS "componentId", title, description, severity, start_time AS "startTime", end_time AS "endTime"', [req.params.id]);
  if (target.rowCount > 0) await auditLog(req.username, 'RESOLVE_INCIDENT', 'INCIDENT', target.rows[0].title);
  res.json(result.rows[0]);
});

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/') && !req.path.includes('.')) {
    return res.sendFile(path.join(rootPath, 'index.html'));
  }
  res.status(404).send('Not Found');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[VOXIMPLANT] Online at http://localhost:${PORT}`));
