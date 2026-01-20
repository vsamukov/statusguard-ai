
import 'dotenv/config';
import express from 'express';
import { Pool } from 'pg';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import * as esbuild from 'esbuild';

const app = express();
const rootPath = path.resolve();

// Middleware
app.use(express.json() as any);

/**
 * PRODUCTION-READY SECURITY
 */
const hashPassword = (password: string): string => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
};

const verifyPassword = (password: string, storedValue: string): boolean => {
  try {
    const [salt, hash] = storedValue.split(':');
    if (!salt || !hash) return false;
    const derivedHash = crypto.scryptSync(password, salt, 64).toString('hex');
    return derivedHash === hash;
  } catch (e) {
    return false;
  }
};

/**
 * ON-THE-FLY TRANSPILATION MIDDLEWARE
 */
app.use(async (req, res, next) => {
  if (req.path.endsWith('.ts') || req.path.endsWith('.tsx')) {
    const filePath = path.join(rootPath, req.path);
    if (!fs.existsSync(filePath)) return next();

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const result = await esbuild.transform(content, {
        loader: 'tsx', // Handles both .ts and .tsx safely
        format: 'esm',
        target: 'es2020',
        sourcemap: 'inline'
      });

      res.type('application/javascript');
      res.send(result.code);
    } catch (err) {
      console.error(`Transpilation error for ${req.path}:`, err);
      res.status(500).send(`console.error("Transpilation failed for ${req.path}");`);
    }
  } else {
    next();
  }
});

// Serve other static files
app.use(express.static(rootPath) as any);

// Database Pool
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString: connectionString || 'postgresql://postgres:postgres@localhost:5432/statusguard',
});

/**
 * DATABASE INITIALIZATION & SEEDING
 */
const initDb = async () => {
  try {
    const client = await pool.connect();
    try {
      const schemaFile = path.join(rootPath, 'schema.sql');
      const seedFile = path.join(rootPath, 'seed.sql');

      if (fs.existsSync(schemaFile)) {
        await client.query(fs.readFileSync(schemaFile, 'utf8'));
      }

      // Ensure Admin User Exists with correct hash
      const userCheck = await client.query('SELECT 1 FROM users WHERE username = $1', ['admin']);
      if (userCheck.rowCount === 0) {
        const pass = process.env.ADMIN_PASS || 'password';
        const hashed = hashPassword(pass);
        await client.query('INSERT INTO users (username, password_hash) VALUES ($1, $2)', ['admin', hashed]);
        console.log('[STATUSGUARD] Created default admin user');
      }

      const { rowCount } = await client.query('SELECT 1 FROM regions LIMIT 1');
      if (rowCount === 0 && fs.existsSync(seedFile)) {
        await client.query(fs.readFileSync(seedFile, 'utf8'));
      }
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database Init Error:', err);
  }
};

initDb();

/**
 * SLA CALCULATION
 */
const calculateSLA = async (componentId: string, days = 90) => {
  try {
    const query = `
      SELECT severity, start_time, end_time 
      FROM incidents 
      WHERE component_id = $1 
      AND (end_time IS NULL OR end_time > NOW() - INTERVAL '${days} days')
    `;
    const { rows } = await pool.query(query, [componentId]);
    const totalSeconds = days * 24 * 60 * 60;
    const startTimeLimit = new Date();
    startTimeLimit.setDate(startTimeLimit.getDate() - days);

    let totalDowntimeSeconds = 0;
    rows.forEach(incident => {
      const start = new Date(Math.max(new Date(incident.start_time).getTime(), startTimeLimit.getTime()));
      const end = incident.end_time ? new Date(incident.end_time) : new Date();
      const durationSeconds = (end.getTime() - start.getTime()) / 1000;
      totalDowntimeSeconds += durationSeconds * (incident.severity === 'OUTAGE' ? 1.0 : 0.5);
    });

    const percentage = ((totalSeconds - totalDowntimeSeconds) / totalSeconds) * 100;
    return parseFloat(Math.max(0, percentage).toFixed(4));
  } catch (e) {
    return 100.00;
  }
};

/**
 * AUTH MIDDLEWARE
 */
const authenticate = (req: any, res: any, next: any) => {
  const token = req.headers.authorization;
  if (token === `Bearer ${process.env.ADMIN_TOKEN || 'statusguard-admin-token'}`) return next();
  res.status(401).json({ error: 'Unauthorized' });
};

/**
 * API ROUTES
 */
app.get('/api/status', async (req: any, res: any) => {
  try {
    const [regions, services, componentsRes, incidents] = await Promise.all([
      pool.query('SELECT id, name FROM regions ORDER BY name'),
      pool.query('SELECT id, region_id AS "regionId", name, description FROM services ORDER BY name'),
      pool.query('SELECT id, service_id AS "serviceId", name, description FROM components ORDER BY name'),
      pool.query(`SELECT id, component_id AS "componentId", title, description, severity, start_time AS "startTime", end_time AS "endTime" FROM incidents WHERE end_time IS NULL OR start_time > NOW() - INTERVAL '7 days' ORDER BY start_time DESC`)
    ]);

    const components = await Promise.all(componentsRes.rows.map(async (c) => ({
      ...c,
      sla90: await calculateSLA(c.id, 90)
    })));

    res.json({ regions: regions.rows, services: services.rows, components, incidents: incidents.rows });
  } catch (err) {
    res.status(500).json({ error: 'Data fetch failed' });
  }
});

app.post('/api/auth/login', async (req: any, res: any) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT password_hash FROM users WHERE username = $1', [username]);
    if (result.rowCount === 0) return res.status(401).json({ error: 'Invalid user' });

    if (verifyPassword(password, result.rows[0].password_hash)) {
      res.json({ token: process.env.ADMIN_TOKEN || 'statusguard-admin-token' });
    } else {
      res.status(401).json({ error: 'Invalid password' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Auth error' });
  }
});

// Admin endpoints (simplified for brevity, ensuring they use 'authenticate')
app.post('/api/admin/regions', authenticate, async (req: any, res: any) => {
  const result = await pool.query('INSERT INTO regions (name) VALUES ($1) RETURNING *', [req.body.name]);
  res.json(result.rows[0]);
});

app.put('/api/admin/regions/:id', authenticate, async (req: any, res: any) => {
  const result = await pool.query('UPDATE regions SET name = $1 WHERE id = $2 RETURNING *', [req.body.name, req.params.id]);
  res.json(result.rows[0]);
});

app.delete('/api/admin/regions/:id', authenticate, async (req: any, res: any) => {
  await pool.query('DELETE FROM regions WHERE id = $1', [req.params.id]);
  res.status(204).send();
});

app.post('/api/admin/services', authenticate, async (req: any, res: any) => {
  const { regionId, name, description } = req.body;
  const result = await pool.query('INSERT INTO services (region_id, name, description) VALUES ($1, $2, $3) RETURNING id, region_id AS "regionId", name, description', [regionId, name, description]);
  res.json(result.rows[0]);
});

app.put('/api/admin/services/:id', authenticate, async (req: any, res: any) => {
  const { name, description } = req.body;
  const result = await pool.query('UPDATE services SET name = $1, description = $2 WHERE id = $3 RETURNING id, region_id AS "regionId", name, description', [name, description, req.params.id]);
  res.json(result.rows[0]);
});

app.delete('/api/admin/services/:id', authenticate, async (req: any, res: any) => {
  await pool.query('DELETE FROM services WHERE id = $1', [req.params.id]);
  res.status(204).send();
});

app.post('/api/admin/components', authenticate, async (req: any, res: any) => {
  const { serviceId, name, description } = req.body;
  const result = await pool.query('INSERT INTO components (service_id, name, description) VALUES ($1, $2, $3) RETURNING id, service_id AS "serviceId", name, description', [serviceId, name, description]);
  res.json(result.rows[0]);
});

app.put('/api/admin/components/:id', authenticate, async (req: any, res: any) => {
  const { name, description } = req.body;
  const result = await pool.query('UPDATE components SET name = $1, description = $2 WHERE id = $3 RETURNING id, service_id AS "serviceId", name, description', [name, description, req.params.id]);
  res.json(result.rows[0]);
});

app.delete('/api/admin/components/:id', authenticate, async (req: any, res: any) => {
  await pool.query('DELETE FROM components WHERE id = $1', [req.params.id]);
  res.status(204).send();
});

app.post('/api/admin/incidents', authenticate, async (req: any, res: any) => {
  const { componentId, title, internalDesc, severity } = req.body;
  const comp = await pool.query('SELECT name FROM components WHERE id = $1', [componentId]);
  const publicDesc = `System Notice: ${comp.rows[0].name} is experiencing ${severity === 'OUTAGE' ? 'a total outage' : 'degradation'}. ${internalDesc}`;
  const result = await pool.query('INSERT INTO incidents (component_id, title, description, severity) VALUES ($1, $2, $3, $4) RETURNING id, component_id AS "componentId", title, description, severity, start_time AS "startTime", end_time AS "endTime"', [componentId, title, publicDesc, severity]);
  res.json(result.rows[0]);
});

app.post('/api/admin/incidents/:id/resolve', authenticate, async (req: any, res: any) => {
  const result = await pool.query('UPDATE incidents SET end_time = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id, component_id AS "componentId", title, description, severity, start_time AS "startTime", end_time AS "endTime"', [req.params.id]);
  res.json(result.rows[0]);
});

app.get('*', (req: any, res: any) => {
  if (!req.path.startsWith('/api/') && !req.path.includes('.')) {
    return res.sendFile(path.join(rootPath, 'index.html'));
  }
  res.status(404).send('Not Found');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[STATUSGUARD] Backend running on port ${PORT}`));
