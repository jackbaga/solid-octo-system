import { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../services/auth.service.js';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const user = verifyToken(token);

  if (!user) {
    return res.status(401).json({ message: '请先登录。' });
  }

  return next();
}
