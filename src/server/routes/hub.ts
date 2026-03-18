
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { hubAuth, AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { loginSchema } from '../utils/schemas.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-dev';

// In-memory dashboard configs for HUB mode
let DASHBOARD_CONFIGS: any[] = [];
try { 
  DASHBOARD_CONFIGS = JSON.parse(process.env.DASHBOARDS || '[]'); 
} catch (e) {
  console.error('Failed to parse DASHBOARDS env var', e);
}

router.post('/auth', validate(loginSchema), async (req, res) => {
  const { username, password } = req.body;
  
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASS || 'password';

  const isUserMatch = username === adminUser;
  let isPassMatch = false;

  if (isUserMatch) {
    // Check if adminPass is a bcrypt hash
    if (adminPass.startsWith('$2')) {
      isPassMatch = await bcrypt.compare(password, adminPass);
    } else {
      // Fallback for plaintext (not recommended for production)
      isPassMatch = password === adminPass;
    }
  }

  if (isUserMatch && isPassMatch) {
    const token = jwt.sign({ username, role: 'hub-admin' }, JWT_SECRET, { expiresIn: '24h' });
    
    res.cookie('session_id', token, { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
    
    res.json({ token, username });
  } else {
    res.status(401).json({ error: 'Invalid Credentials' });
  }
});

router.get('/configs', hubAuth, (req: AuthRequest, res) => {
  res.json(DASHBOARD_CONFIGS);
});

export default router;
