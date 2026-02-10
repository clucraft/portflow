import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ApiError } from './errorHandler.js';

export interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  role: 'admin' | 'member' | 'viewer';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret;
};

export const requireAuth = (req: Request, _res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Authentication required');
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, getJwtSecret()) as AuthUser;
    req.user = decoded;
    next();
  } catch (err) {
    if (err instanceof ApiError) {
      next(err);
    } else {
      next(ApiError.unauthorized('Invalid or expired token'));
    }
  }
};

export const requireAdmin = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(ApiError.unauthorized('Authentication required'));
  }
  if (req.user.role !== 'admin') {
    return next(ApiError.forbidden('Admin access required'));
  }
  next();
};

export const requireWrite = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(ApiError.unauthorized('Authentication required'));
  }
  if (req.user.role === 'viewer') {
    return next(ApiError.forbidden('Write access required'));
  }
  next();
};

// Middleware that blocks viewers from mutating endpoints (POST/PUT/PATCH/DELETE)
export const writeGuard = (req: Request, _res: Response, next: NextFunction) => {
  const readOnlyMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (readOnlyMethods.includes(req.method)) {
    return next();
  }
  if (req.user && req.user.role === 'viewer') {
    return next(ApiError.forbidden('Viewers cannot perform write operations'));
  }
  next();
};
