import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole, DEFAULT_TENANT_ID, DEFAULT_BRANCH_ID } from '@lspot/shared';

export interface AuthenticatedUser {
  id: string;
  tenantId: string;
  branchId: string;
  username: string;
  fullName: string;
  role: UserRole;
}

export interface RequestWithUser extends Request {
  user?: AuthenticatedUser;
}

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('CRITICAL: JWT_SECRET environment variable must be configured in production.');
  }
  return secret || 'lspot-restaurant-super-secret-jwt-key-2026';
}

export function authenticate(req: RequestWithUser, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Provide a development fallback only if explicitly enabled via configuration
    if (process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEV_AUTH_BYPASS === 'true') {
      req.user = {
        id: '22222222-2222-2222-2222-222222222222',
        tenantId: DEFAULT_TENANT_ID,
        branchId: DEFAULT_BRANCH_ID,
        username: 'manager',
        fullName: 'Mulenga Banda (Manager)',
        role: UserRole.MANAGER
      };
      return next();
    }
    return res.status(401).json({
      success: false,
      message: 'Access denied. No authentication token provided.',
      code: 'UNAUTHORIZED'
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as AuthenticatedUser;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired authentication token.',
      code: 'INVALID_TOKEN'
    });
  }
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: RequestWithUser, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
        code: 'UNAUTHORIZED'
      });
    }

    if (!allowedRoles.includes(req.user.role) && req.user.role !== UserRole.SUPER_ADMIN) {
      return res.status(403).json({
        success: false,
        message: `Forbidden. Role '${req.user.role}' is not authorized to perform this operation.`,
        code: 'FORBIDDEN'
      });
    }

    next();
  };
}

const authRateBuckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimitAuth(maxAttempts = 12, windowMs = 5 * 60 * 1000) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (process.env.NODE_ENV === 'test') {
      return next();
    }
    const clientIp = String(req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress || 'unknown')
      .split(',')[0]
      .trim();
    const bucketKey = `${clientIp}:${req.path}`;
    const now = Date.now();
    const entry = authRateBuckets.get(bucketKey);

    if (!entry || now > entry.resetAt) {
      authRateBuckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count += 1;
    if (entry.count > maxAttempts) {
      const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        success: false,
        message: `Too many authentication attempts. Please wait ${retryAfterSec} seconds before trying again.`,
        code: 'RATE_LIMITED'
      });
    }

    return next();
  };
}
