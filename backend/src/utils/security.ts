import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { JWTPayload } from '../models';

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(payload: JWTPayload): string {
  const secret = process.env.JWT_SECRET || 'your_jwt_secret_key';
  const expiresIn = process.env.JWT_EXPIRES_IN || '24h';
  return jwt.sign(payload as any, secret as any, {
    expiresIn: expiresIn as any
  } as any);
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    const secret = process.env.JWT_SECRET || 'your_jwt_secret_key';
    return jwt.verify(token, secret) as JWTPayload;
  } catch {
    return null;
  }
}
