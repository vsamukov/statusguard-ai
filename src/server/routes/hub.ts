
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
  
  console.log(`[HUB] Login attempt for user: ${username}`);

  const isUserMatch = username === ADMIN_USER;
  let isPassMatch = false;

  if (isUserMatch) {
    // Check if adminPass is a bcrypt hash
    if (ADMIN_PASS.startsWith('$2')) {
      isPassMatch = await bcrypt.compare(password, ADMIN_PASS);
      console.log(`[HUB] Password comparison (bcrypt): ${isPassMatch}`);
    } else {
      // Fallback for plaintext (not recommended for production)
      isPassMatch = password === ADMIN_PASS;
      console.log(`[HUB] Password comparison (plaintext): ${isPassMatch}`);
    }
  } else {
    console.warn(`[HUB] User mismatch: expected ${ADMIN_USER}, got ${username}`);
  }

  if (isUserMatch && isPassMatch) {
    const token = jwt.sign({ username, role: 'hub-admin' }, JWT_SECRET, { expiresIn: '24h' });
    console.log(`[HUB] Login successful, token generated`);
    
    res.cookie('vox_hub_session', token, { 
      httpOnly: true, 
      secure: true, 
      sameSite: 'none',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
    
    res.json({ token, username });
  } else {
    console.error(`[HUB] Login failed: Invalid Credentials`);
    res.status(401).json({ error: 'Invalid Credentials' });
  }
});

router.get('/configs', hubAuth, (req: AuthRequest, res) => {
  console.log(`[HUB] Fetching configs. Current count: ${DASHBOARD_CONFIGS.length}`);
  res.json(DASHBOARD_CONFIGS);
});

export default router;
