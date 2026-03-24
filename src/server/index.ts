
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
import { MODE, IS_HUB, PORT } from './config.js';
import { incidentService } from './services/incidentService.js';

const app = express();
const rootPath = path.resolve();
console.log(`[SERVER] MODE: ${MODE}, IS_HUB: ${IS_HUB}`);

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
app.use(express.json({ limit: '1mb' })); // Limit body size
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
  
  // Skip if it's an API route, health check, or the root path
  if (cleanPath === '/' || cleanPath.startsWith('/api') || cleanPath.startsWith('/health')) return next();

  // Ensure we are looking in the project root
  const projectRoot = process.cwd();
  let filePath = path.join(projectRoot, cleanPath.startsWith('/') ? cleanPath.substring(1) : cleanPath);
  let loader: esbuild.Loader | null = null;

  // 1. Try exact path for .ts/.tsx
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    if (cleanPath.endsWith('.ts')) loader = 'ts';
    else if (cleanPath.endsWith('.tsx')) loader = 'tsx';
  } 
  
  // 2. Try adding extensions if no loader found (for extensionless imports)
  if (!loader) {
    const extensions: { ext: string, l: esbuild.Loader }[] = [
      { ext: '.tsx', l: 'tsx' },
      { ext: '.ts', l: 'ts' },
      { ext: '/index.tsx', l: 'tsx' },
      { ext: '/index.ts', l: 'ts' }
    ];
    for (const { ext, l } of extensions) {
      const p = filePath + ext;
      if (fs.existsSync(p) && fs.statSync(p).isFile()) {
        filePath = p;
        loader = l;
        break;
      }
    }
  }

  // 3. Try mapping .js requests to .ts/.tsx files
  if (!loader && cleanPath.endsWith('.js')) {
    const base = filePath.slice(0, -3);
    const extensions: { ext: string, l: esbuild.Loader }[] = [
      { ext: '.tsx', l: 'tsx' },
      { ext: '.ts', l: 'ts' }
    ];
    for (const { ext, l } of extensions) {
      const p = base + ext;
      if (fs.existsSync(p) && fs.statSync(p).isFile()) {
        filePath = p;
        loader = l;
        break;
      }
    }
  }

  if (loader) {
    try {
      const stats = fs.statSync(filePath);
      const cached = transpilationCache.get(filePath);
      
      if (cached && cached.mtime === stats.mtimeMs) {
        return res.type('application/javascript').send(cached.code);
      }

      const content = fs.readFileSync(filePath, 'utf8');
      const result = await esbuild.transform(content, {
        loader,
        format: 'esm',
        target: 'es2020',
        sourcemap: 'inline',
        define: { 
          'process.env.API_KEY': JSON.stringify(process.env.API_KEY || ''),
          'process.env.IS_HUB': JSON.stringify(process.env.IS_HUB === 'true' || IS_HUB),
          'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
        }
      });
      
      transpilationCache.set(filePath, { code: result.code, mtime: stats.mtimeMs });
      res.type('application/javascript').send(result.code);
    } catch (err: any) {
      console.error(`Transpilation failed for ${cleanPath}:`, err);
      res.status(500).type('application/javascript').send(`console.error("Transpilation failed for ${cleanPath}: ${err.message.replace(/"/g, '\\"')}");`);
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

(async () => {
  try {
    await migrateDb(IS_HUB);
    console.log(`[SERVICE] Starting in ${MODE} mode (IS_HUB=${IS_HUB})`);
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[SERVICE] Running on port ${PORT} (MODE=${MODE})`);
    });

    // Background task for NOC notifications (every 10 minutes)
    if (!IS_HUB) {
      setInterval(() => {
        incidentService.checkOpenIncidentsAndNotifyNOC();
      }, 10 * 60 * 1000);
      // Run once on startup
      incidentService.checkOpenIncidentsAndNotifyNOC();
    }
  } catch (err) {
    console.error('[FATAL] Service failed to start:', err);
    process.exit(1);
  }
})();
