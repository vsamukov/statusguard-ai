
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { hubAuth, AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { loginSchema } from '../utils/schemas.js';
import { JWT_SECRET, ADMIN_USER, ADMIN_PASS, DASHBOARD_CONFIGS } from '../config.js';

const router = Router();

router.post('/auth', validate(loginSchema), async (req, res) => {
  const { username, password } = req.body;
  
  const isUserMatch = username === ADMIN_USER;
  let isPassMatch = false;

  if (isUserMatch) {
    // Check if adminPass is a bcrypt hash
    if (ADMIN_PASS.startsWith('$2')) {
      isPassMatch = await bcrypt.compare(password, ADMIN_PASS);
    } else {
      // Fallback for plaintext (not recommended for production)
      isPassMatch = password === ADMIN_PASS;
    }
  }

  if (isUserMatch && isPassMatch) {
    const token = jwt.sign({ username, role: 'hub-admin' }, JWT_SECRET, { expiresIn: '24h' });
    
    res.cookie('session_id', token, { 
      httpOnly: true, 
      secure: true, 
      sameSite: 'none',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
    
    res.json({ token, username });
  } else {
    res.status(401).json({ error: 'Invalid Credentials' });
  }
});

router.get('/configs', hubAuth, (req: AuthRequest, res) => {
  console.log(`[HUB] Fetching configs. Current count: ${DASHBOARD_CONFIGS.length}`);
  res.json(DASHBOARD_CONFIGS);
});

export default router;
