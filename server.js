
import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import * as esbuild from 'esbuild';
import crypto from 'crypto';

const app = express();
const rootPath = path.resolve();

app.use(express.json());
app.use(cookieParser());

// Portal Authentication Sessions
const portalSessions = new Map();

/**
 * DASHBOARD CONFIGURATIONS FROM ENV
 * Expected format: DASHBOARDS=[{"id":"app1","name":"Main Service","url":"http://service1.com","adminSecret":"super-secret-1","color":"#EF4444"},...]
 */
const DASHBOARD_CONFIGS = JSON.parse(process.env.DASHBOARDS || '[]');

/**
 * AUTHENTICATION MIDDLEWARE FOR PORTAL
 */
const authenticatePortal = (req, res, next) => {
  const token = req.cookies.session_id || req.headers.authorization?.split(' ')[1];
  const username = portalSessions.get(token);
  if (!username) return res.status(401).json({ error: 'Unauthorized Access to Portal' });
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
        define: { 'process.env.API_KEY': JSON.stringify(process.env.API_KEY || '') }
      });
      res.type('application/javascript').send(result.code);
    } catch (err) {
      console.error(`Transpilation failed for ${cleanPath}:`, err);
      res.status(500).send(`console.error("Transpilation failed for ${cleanPath}");`);
    }
  } else {
    next();
  }
});

/**
 * PORTAL API ROUTES
 */

// Portal Auth
app.post('/api/portal/auth', async (req, res) => {
  const { username, password } = req.body;
  // Master login for the support team hub
  const MASTER_USER = process.env.ADMIN_USER || 'admin';
  const MASTER_PASS = process.env.ADMIN_PASS || 'password';

  if (username === MASTER_USER && password === MASTER_PASS) {
    const token = crypto.randomBytes(32).toString('hex');
    portalSessions.set(token, username);
    res.cookie('session_id', token, { httpOnly: true, secure: false });
    res.json({ token, username });
  } else {
    res.status(401).json({ error: 'Invalid portal credentials' });
  }
});

// Fetch Remote Dashboard Hub Configurations
app.get('/api/portal/configs', authenticatePortal, (req, res) => {
  res.json(DASHBOARD_CONFIGS);
});

/**
 * NOTE: The individual dashboard nodes should have their own 
 * CRUD endpoints secured by checking the X-ADMIN-SECRET header.
 * 
 * In those applications, the middleware would look like:
 * const nodeAuth = (req, res, next) => {
 *   const secret = req.headers['x-admin-secret'];
 *   if (secret !== process.env.ADMIN_SECRET) return res.status(401).json({error: 'Forbidden'});
 *   next();
 * }
 */

// Static Assets
app.use(express.static(rootPath));
app.get('*', (req, res) => res.sendFile(path.join(rootPath, 'index.html')));

const port = parseInt(process.env.PORT || '3000');
app.listen(port, () => console.log(`[PORTAL HUB] Ready at http://localhost:${port}`));
