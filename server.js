
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
      // Check if regions exists to avoid re-seeding (which runs TRUNCATE)
      const { rowCount } = await client.query('SELECT 1 FROM regions LIMIT 1');
      if (rowCount === 0 && fs.existsSync(seedFile)) {
        console.log('[VOXIMPLANT] Empty database detected. Seeding initial data...');
        await client.query(fs.readFileSync(seedFile, 'utf8'));
      } else {
        console.log('[VOXIMPLANT] Database already contains data. Skipping