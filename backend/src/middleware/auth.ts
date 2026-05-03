import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWTPayload } from '../models';

export interface AuthRequest extends Request {
  user?: JWTPayload & { userId: string };
  file?: Express.Multer.File;
  body: any;
  params: any;
  ip: string;
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }
    const secret = process.env.JWT_SECRET || 'your_jwt_secret_key';
    const decoded = jwt.verify(token, secret) as JWTPayload;
    console.log('🔵 AUTH: decoded =', JSON.stringify(decoded, null, 2));
    req.user = { ...decoded, userId: decoded.userId };
    console.log('🔵 AUTH: req.user =', JSON.stringify(req.user, null, 2));
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

export const adminMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  console.log('🔵 ADMIN: req.user =', JSON.stringify(req.user, null, 2));
  if (!req.user?.isAdmin) {
    console.log('🔴 ADMIN: isAdmin is false or missing');
    return res.status(403).json({ message: 'Admin access required' });
  }
  console.log('🟢 ADMIN: access granted');
  next();
};

export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};