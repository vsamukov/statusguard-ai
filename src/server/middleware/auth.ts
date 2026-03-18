
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-for-dev';

export interface AuthRequest extends Request {
  user?: any;
}

export const hubAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.cookies.session_id || req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
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

  if (secret && secret === process.env.ADMIN_SECRET) {
    req.user = { role: 'admin', username: 'remote-admin' };
    return next();
  }
  
  return res.status(401).json({ error: 'Unauthorized: Invalid credentials' });
};
