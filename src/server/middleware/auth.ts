
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET, ADMIN_SECRET } from '../config.js';

export interface AuthRequest extends Request {
  user?: any;
}

export const hubAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const cookieToken = req.cookies.session_id;
  const headerToken = req.headers.authorization?.split(' ')[1];
  
  // Try cookie first, then header
  const tokens = [cookieToken, headerToken].filter(Boolean);
  
  if (tokens.length === 0) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  let lastError = null;
  for (const token of tokens) {
    try {
      const decoded = jwt.verify(token!, JWT_SECRET);
      req.user = decoded;
      return next();
    } catch (err) {
      lastError = err;
    }
  }

  return res.status(401).json({ error: 'Unauthorized: Invalid token' });
};

export const nodeAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  // Support both JWT session and X-ADMIN-SECRET header
  const token = req.cookies.session_id || req.headers.authorization?.split(' ')[1];
  const secret = req.headers['x-admin-secret'];
  
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      return next();
    } catch (err) {
      // If token is invalid, fall back to secret check
    }
  }

  if (secret && secret === ADMIN_SECRET) {
    req.user = { role: 'admin', username: 'remote-admin' };
    return next();
  }
  
  return res.status(401).json({ error: 'Unauthorized: Invalid credentials' });
};
