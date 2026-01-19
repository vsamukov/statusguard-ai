
import 'dotenv/config';
import express from 'express';
import { Pool } from 'pg';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const app = express();
// Using any cast for middleware setup to ensure compatibility across different express versions
app.use((express.json() as any));

// Database Pool
// Ensure DATABASE_URL is defined; fallback to a default if necessary to prevent SCRAM errors
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.warn('WARNING: DATABASE_URL is not defined in environment variables. Falling back to default.');
}

const pool = new Pool({
  connectionString: connectionString || 'postgresql://postgres:postgres@localhost:5432/statusguard',
});

/**
 * PRODUCTION-READY SECURITY
 */
const hashPassword = (password: string): string => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
};

const verifyPassword = (password: string, storedValue: string): boolean => {
  const [salt, hash] = storedValue.split(':');
  const derivedHash = crypto.scryptSync(password, salt, 64).toString('hex');
  return derivedHash === hash;
};

/**
 * SLA CALCULATION LOGIC
 * Calculates availability for the last 90 days.
 * Outage = 100% loss, Degradation = 50% loss for the duration.
 */
const calculateSLA = async (componentId: string, days = 90) => {
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
    
    // Weighted downtime
    const weight = incident.severity === 'OUTAGE' ? 1.0 : 0.5;
    totalDowntimeSeconds += durationSeconds * weight;
  });

  const uptime = Math.max(0, totalSeconds - totalDowntimeSeconds);
  const percentage = (uptime / totalSeconds) * 100;
  return parseFloat(percentage.toFixed(4));
};

/**
 * DATABASE INITIALIZATION
 */
const initDb = async () => {
  try {
    const client = await pool.connect();
    try {
      const schemaFile = path.join(process.cwd(), 'schema.sql');
      const seedFile = path.join(process.cwd(), 'seed.sql');

      if (fs.existsSync(schemaFile)) {
        await client.query(fs.readFileSync(schemaFile, 'utf8'));
        console.log('Schema applied.');
      }

      // Only seed if empty
      const { rowCount } = await client.query('SELECT 1 FROM regions LIMIT 1');
      if (rowCount === 0 && fs.existsSync(seedFile)) {
        await client.query(fs.readFileSync(seedFile, 'utf8'));
        console.log('Seed data applied.');
      }
    } catch (err) {
      console.error('Database Init Error:', err);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Failed to connect to the database during initialization:', err);
  }
};

initDb();

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
    const regions = await pool.query('SELECT id, name FROM regions ORDER BY name');
    const services = await pool.query('SELECT id, region_id AS "regionId", name, description FROM services ORDER BY name');
    const componentsRes = await pool.query('SELECT id, service_id AS "serviceId", name, description FROM components ORDER BY name');
    const incidents = await pool.query(`
      SELECT id, component_id AS "componentId", title, description, severity, start_time AS "startTime", end_time AS "endTime" 
      FROM incidents 
      WHERE end_time IS NULL OR start_time > NOW() - INTERVAL '7 days'
      ORDER BY start_time DESC
    `);

    // Enrich components with SLA data
    const components = await Promise.all(componentsRes.rows.map(async (c) => ({
      ...c,
      sla90: await calculateSLA(c.id, 90)
    })));

    res.json({
      regions: regions.rows,
      services: services.rows,
      components,
      incidents: incidents.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch status map' });
  }
});

app.post('/api/auth/login', async (req: any, res: any) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT password_hash FROM users WHERE username = $1', [username]);
    if (result.rowCount === 0) return res.status(401).json({ error: 'Invalid credentials' });

    if (verifyPassword(password, result.rows[0].password_hash)) {
      res.json({ token: process.env.ADMIN_TOKEN || 'statusguard-admin-token' });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Auth server error' });
  }
});

app.post('/api/admin/regions', authenticate, async (req: any, res: any) => {
  const { name } = req.body;
  const result = await pool.query('INSERT INTO regions (name) VALUES ($1) RETURNING *', [name]);
  res.json(result.rows[0]);
});

app.put('/api/admin/regions/:id', authenticate, async (req: any, res: any) => {
  const { name } = req.body;
  const result = await pool.query('UPDATE regions SET name = $1 WHERE id = $2 RETURNING *', [name, req.params.id]);
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
  try {
    const comp = await pool.query('SELECT name FROM components WHERE id = $1', [componentId]);
    if (comp.rowCount === 0) return res.status(404).json({ error: 'Component not found' });
    
    // Standard template for incident descriptions
    const publicDesc = `System Notice: ${comp.rows[0].name} is currently experiencing ${severity === 'OUTAGE' ? 'a full outage' : 'performance degradation'}. ${internalDesc}`;
    
    const result = await pool.query(
      'INSERT INTO incidents (component_id, title, description, severity) VALUES ($1, $2, $3, $4) RETURNING id, component_id AS "componentId", title, description, severity, start_time AS "startTime", end_time AS "endTime"',
      [componentId, title, publicDesc, severity]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Incident Creation Error:', err);
    res.status(500).json({ error: 'Incident creation failed' });
  }
});

app.post('/api/admin/incidents/:id/resolve', authenticate, async (req: any, res: any) => {
  const result = await pool.query('UPDATE incidents SET end_time = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id, component_id AS "componentId", title, description, severity, start_time AS "startTime", end_time AS "endTime"', [req.params.id]);
  res.json(result.rows[0]);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[STATUSGUARD] Node.js Backend running on port ${PORT}`));
