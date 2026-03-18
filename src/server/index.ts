
import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import * as esbuild from 'esbuild';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import nodeRoutes from './routes/node.js';
import hubRoutes from './routes/hub.js';
import { migrateDb } from './migrate.js';

const app = express();
const rootPath = path.resolve();
const MODE = process.env.MODE || 'NODE';
const IS_HUB = MODE === 'HUB';

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for easier integration in this environment
}));

app.use(cors({
  origin: (origin, callback) => {
    // Whitelist specific origins or allow all in dev
    const whitelist = process.env.CORS_WHITELIST?.split(',') || [];
    if (!origin || whitelist.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(morgan('combined'));
app.use(express.json({ limit: '10kb' })); // Limit body size
app.use(cookieParser());

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes',
});
app.use('/api/', limiter);

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', mode: MODE, timestamp: new Date().toISOString() });
});

// Runtime Transpilation Middleware (Optimized with caching)
const transpilationCache = new Map<string, { code: string, mtime: number }>();

app.use(async (req, res, next) => {
  const cleanPath = req.path.split('?')[0];
  if (cleanPath.endsWith('.ts') || cleanPath.endsWith('.tsx')) {
    const filePath = path.join(rootPath, cleanPath.startsWith('/') ? cleanPath.substring(1) : cleanPath);
    if (!fs.existsSync(filePath)) return next();
    
    try {
      const stats = fs.statSync(filePath);
      const cached = transpilationCache.get(filePath);
      
      if (cached && cached.mtime === stats.mtimeMs) {
        return res.type('application/javascript').send(cached.code);
      }

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
      
      transpilationCache.set(filePath, { code: result.code, mtime: stats.mtimeMs });
      res.type('application/javascript').send(result.code);
    } catch (err) {
      console.error('Transpilation failed:', err);
      res.status(500).send(`console.error("Transpilation failed");`);
    }
  } else next();
});

// API Routes
if (IS_HUB) {
  app.use('/api/portal', hubRoutes);
} else {
  app.use('/api', nodeRoutes);
}

// Static Files & SPA Fallback
app.use(express.static(rootPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(rootPath, 'index.html'));
});

const port = parseInt(process.env.PORT || '3000');

(async () => {
  try {
    await migrateDb(IS_HUB);
    app.listen(port, '0.0.0.0', () => {
      console.log(`[SERVICE] Running on port ${port} (MODE=${MODE})`);
    });
  } catch (err) {
    console.error('[FATAL] Service failed to start:', err);
    process.exit(1);
  }
})();
