
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET, ADMIN_SECRET } from '../config.js';

export interface AuthRequest extends Request {
  user?: any;
}

export const hubAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.cookies?.session_id || req.headers.authorization?.split(' ')[1];
  const secret = req.headers['x-admin-secret'];
  
  console.log(`[AUTH] hubAuth attempt: path=${req.path}, token_raw="${token}", secret=${secret ? 'present' : 'missing'}`);

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      req.user = decoded;
      console.log(`[AUTH] hubAuth: JWT valid for user ${decoded.username}, role ${decoded.role}`);
      return next();
    } catch (err: any) {
      console.warn(`[AUTH] hubAuth: JWT invalid (token="${token}"): ${err.message}`);
      // Fall back to secret check
    }
  }

  if (secret && (secret === ADMIN_SECRET || (Array.isArray(secret) && secret.includes(ADMIN_SECRET)))) {
    req.user = { role: 'admin', username: 'remote-admin' };
    console.log(`[AUTH] hubAuth: Secret valid`);
    return next();
  }

  console.error(`[AUTH] hubAuth: Unauthorized access attempt to ${req.path}`);
  return res.status(401).json({ error: 'Unauthorized: Invalid credentials' });
};

export const nodeAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.cookies.session_id || req.headers.authorization?.split(' ')[1];
  const secret = req.headers['x-admin-secret'];
  
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      return next();
    } catch (err) {
      // Fall back to secret check
    }
  }

  if (secret && (secret === ADMIN_SECRET || (Array.isArray(secret) && secret.includes(ADMIN_SECRET)))) {
    req.user = { role: 'admin', username: 'remote-admin' };
    return next();
  }
  
  return res.status(401).json({ error: 'Unauthorized: Invalid credentials' });
};
