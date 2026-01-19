
import express from 'express';
import { Pool } from 'pg';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(express.json() as any);

// DB Configuration via environment variables
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Hashing Utilities
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
 * Public Description Generator (Template-based)
 */
const generatePublicDescription = (
  componentName: string,
  severity: string,
  internalDesc: string
): string => {
  const statusMessage = severity === 'OUTAGE' 
    ? "is currently experiencing a service outage" 
    : "is experiencing performance degradation";
    
  return `The ${componentName} component ${statusMessage}. Internal reports indicate: "${internalDesc}". Our engineering team is currently investigating the root cause and working towards a resolution.`;
};

/**
 * Database Initialization
 * Reads from schema.sql and seed.sql if they exist
 */
const initDb = async () => {
  const client = await pool.connect();
  try {
    const schemaPath = path.join(process.cwd(), 'schema.sql');
    const seedPath = path.join(process.cwd(), 'seed.sql');

    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf8');
      await client.query(schema);
      console.log('Database schema applied.');
    }

    if (fs.existsSync(seedPath)) {
      const seed = fs.readFileSync(seedPath, 'utf8');
      await client.query(seed);
      console.log('Database seed data applied.');
    }

    // Ensure at least one admin exists if not seeded via file
    const { rowCount } = await client.query('SELECT 1 FROM users LIMIT 1');
    if (rowCount === 0) {
      const defaultUser = process.env.ADMIN_USER || 'admin';
      const defaultPass = process.env.ADMIN_PASS || 'password';
      const hashedPass = hashPassword(defaultPass);
      await client.query('INSERT INTO users (username, password_hash) VALUES ($1, $2)', [defaultUser, hashedPass]);
      console.log(`Default user '${defaultUser}' created.`);
    }
  } catch (err) {
    console.error('Database initialization failed:', err);
  } finally {
    client.release();
  }
};

initDb();

/**
 * Auth Middleware
 */
const authenticate = (req: any, res: any, next: any) => {
  const token = req.headers.authorization;
  // In a real production app, use JWT verification here
  if (token === `Bearer ${process.env.ADMIN_TOKEN || 'statusguard-admin-token'}`) return next();
  res.status(401).json({ error: 'Unauthorized' });
};

/**
 * Routes
 */

app.get('/api/status', async (req, res) => {
  try {
    const regions = await pool.query('SELECT id, name FROM regions');
    const services = await pool.query('SELECT id, region_id AS "regionId", name, description FROM services');
    const components = await pool.query('SELECT id, service_id AS "serviceId", name, description FROM components');
    const incidents = await pool.query('SELECT id, component_id AS "componentId", title, description, severity, start_time AS "startTime", end_time AS "endTime" FROM incidents WHERE end_time IS NULL OR start_time > NOW() - INTERVAL \'7 days\'');
    
    res.json({
      regions: regions.rows,
      services: services.rows,
      components: components.rows,
      incidents: incidents.rows
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT password_hash FROM users WHERE username = $1', [username]);
    if (result.rowCount === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = verifyPassword(password, result.rows[0].password_hash);
    if (isMatch) {
      // Return a stable token for this mock setup
      res.json({ token: process.env.ADMIN_TOKEN || 'statusguard-admin-token' });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

app.post('/api/admin/regions', authenticate, async (req, res) => {
  const { name } = req.body;
  const result = await pool.query('INSERT INTO regions (name) VALUES ($1) RETURNING *', [name]);
  res.json(result.rows[0]);
});

app.put('/api/admin/regions/:id', authenticate, async (req, res) => {
  const { name } = req.body;
  const result = await pool.query('UPDATE regions SET name = $1 WHERE id = $2 RETURNING *', [name, req.params.id]);
  res.json(result.rows[0]);
});

app.delete('/api/admin/regions/:id', authenticate, async (req, res) => {
  await pool.query('DELETE FROM regions WHERE id = $1', [req.params.id]);
  res.status(204).send();
});

app.post('/api/admin/services', authenticate, async (req, res) => {
  const { regionId, name, description } = req.body;
  const result = await pool.query('INSERT INTO services (region_id, name, description) VALUES ($1, $2, $3) RETURNING id, region_id AS "regionId", name, description', [regionId, name, description]);
  res.json(result.rows[0]);
});

app.put('/api/admin/services/:id', authenticate, async (req, res) => {
  const { name, description } = req.body;
  const result = await pool.query('UPDATE services SET name = $1, description = $2 WHERE id = $3 RETURNING id, region_id AS "regionId", name, description', [name, description, req.params.id]);
  res.json(result.rows[0]);
});

app.delete('/api/admin/services/:id', authenticate, async (req, res) => {
  await pool.query('DELETE FROM services WHERE id = $1', [req.params.id]);
  res.status(204).send();
});

app.post('/api/admin/components', authenticate, async (req, res) => {
  const { serviceId, name, description } = req.body;
  const result = await pool.query('INSERT INTO components (service_id, name, description) VALUES ($1, $2, $3) RETURNING id, service_id AS "serviceId", name, description', [serviceId, name, description]);
  res.json(result.rows[0]);
});

app.put('/api/admin/components/:id', authenticate, async (req, res) => {
  const { name, description } = req.body;
  const result = await pool.query('UPDATE components SET name = $1, description = $2 WHERE id = $3 RETURNING id, service_id AS "serviceId", name, description', [name, description, req.params.id]);
  res.json(result.rows[0]);
});

app.delete('/api/admin/components/:id', authenticate, async (req, res) => {
  await pool.query('DELETE FROM components WHERE id = $1', [req.params.id]);
  res.status(204).send();
});

app.post('/api/admin/incidents', authenticate, async (req, res) => {
  const { componentId, title, internalDesc, severity } = req.body;
  
  try {
    const compResult = await pool.query('SELECT name FROM components WHERE id = $1', [componentId]);
    const compName = compResult.rows[0]?.name || 'Unknown Component';
    const publicDesc = generatePublicDescription(compName, severity, internalDesc);
    
    const result = await pool.query(
      'INSERT INTO incidents (component_id, title, description, severity) VALUES ($1, $2, $3, $4) RETURNING id, component_id AS "componentId", title, description, severity, start_time AS "startTime", end_time AS "endTime"',
      [componentId, title, publicDesc, severity]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create incident' });
  }
});

app.post('/api/admin/incidents/:id/resolve', authenticate, async (req, res) => {
  try {
    const result = await pool.query('UPDATE incidents SET end_time = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id, component_id AS "componentId", title, description, severity, start_time AS "startTime", end_time AS "endTime"', [req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to resolve incident' });
  }
});

app.listen(process.env.PORT || 3000, () => console.log(`Backend running on port ${process.env.PORT || 3000}`));
