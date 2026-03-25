
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { hubAuth, AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { loginSchema } from '../utils/schemas.js';
import { JWT_SECRET, HUB_USERS, DASHBOARD_CONFIGS } from '../config.js';

const router = Router();

router.post('/auth', validate(loginSchema), async (req, res) => {
  const { username, password } = req.body;
  
  console.log(`[HUB] Login attempt for user: ${username}`);

  const userPass = HUB_USERS[username];
  let isPassMatch = false;

  if (userPass) {
    // Check if userPass is a bcrypt hash
    if (userPass.startsWith('$2')) {
      isPassMatch = await bcrypt.compare(password, userPass);
    } else {
      // Fallback for plaintext (not recommended for production)
      isPassMatch = password === userPass;
    }
  }

  if (userPass && isPassMatch) {
    const token = jwt.sign({ username, role: 'hub-admin' }, JWT_SECRET, { expiresIn: '24h' });
    console.log(`[HUB] Login successful for user ${username}`);
    
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
